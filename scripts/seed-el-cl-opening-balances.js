// One-time cutover script for the Earned Leave / Casual Leave split.
//
// Run this ONCE, AFTER migration 00000000000051_leave_el_cl_split.sql has
// been applied to the live database (it needs the el_opening_balance/
// cl_opening_balance columns to exist).
//
// CRITICAL: this script NEVER inserts into leave_requests. It only writes
// two numeric columns directly on each employee's own profiles row -
// exactly per the requirement that the bifurcation must never create a
// Manual Credit/Deduction transaction or touch the leave ledger. The
// employee's total balance (EL + CL) is mathematically identical to their
// balance one second before this script ran.
//
// For every profile, this:
//   1. Computes their CURRENT remaining leave balance using the exact same
//      formula the app has always used (lib/leave.ts's calculateAccruedLeaves,
//      reimplemented here in plain JS since this script runs standalone -
//      kept byte-for-byte equivalent to that function, which itself is
//      preserved unchanged in lib/leave.ts specifically for this purpose).
//   2. Splits that remaining balance into Earned/Casual using the explicit
//      rounding rule: even -> equal split; odd -> extra day to Earned;
//      any fractional remainder -> Casual (mirrors lib/leave.ts's
//      splitElClOpeningBalance(), reimplemented here for the same reason).
//   3. Writes el_opening_balance and cl_opening_balance directly on that
//      employee's profiles row via a plain UPDATE - no insert, no new row,
//      no leave_requests table involved at all.
//
// Idempotent by construction: it only ever UPDATEs the two columns to the
// freshly recomputed split of the CURRENT balance. Running it twice before
// anyone applies for leave or a new month accrues reproduces the same
// numbers. Running it again LATER (after leave has been taken/accrued
// under the new system) would recompute from a balance that no longer
// reflects "pre-split history" alone - so treat this as run-once in
// practice, same as any one-time data migration.

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const env = {};
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const m = /^([A-Z_]+)\s*=\s*"?([^"\n\r]*)"?\s*$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
});

const { createClient } = require(path.join(__dirname, "..", "node_modules", "@supabase", "supabase-js"));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- Byte-for-byte copy of lib/leave.ts's PRE-SPLIT formula ----
const LEAVE_RESET_YEAR = 2026;
const LEAVE_RESET_MONTH = 7; // August (0-indexed)

function monthsOfAutomaticAccrual(dateOfJoining, targetYear, targetMonth1Indexed) {
  let startYear = LEAVE_RESET_YEAR;
  let startMonth = LEAVE_RESET_MONTH;
  if (dateOfJoining) {
    const joinDate = new Date(dateOfJoining);
    if (!isNaN(joinDate.getTime())) {
      const joinYear = joinDate.getFullYear();
      const joinMonth = joinDate.getMonth();
      const joinIsLater = joinYear > LEAVE_RESET_YEAR || (joinYear === LEAVE_RESET_YEAR && joinMonth > LEAVE_RESET_MONTH);
      if (joinIsLater) {
        startYear = joinYear;
        startMonth = joinMonth;
      }
    }
  }
  const totalMonths = (targetYear - startYear) * 12 + ((targetMonth1Indexed - 1) - startMonth);
  return Math.max(0, totalMonths);
}

function calculateMonthsEmployed(dateOfJoining, inactiveSince) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  let effective = now;
  if (inactiveSince) {
    const inactiveRaw = new Date(inactiveSince);
    if (!isNaN(inactiveRaw.getTime())) {
      const inactiveIST = new Date(inactiveRaw.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      if (inactiveIST < effective) effective = inactiveIST;
    }
  }
  return monthsOfAutomaticAccrual(dateOfJoining, effective.getFullYear(), effective.getMonth() + 1);
}

function calculateAccruedLeaves(dateOfJoining, leaves, inactiveSince) {
  const months = calculateMonthsEmployed(dateOfJoining, inactiveSince);
  const automaticLeaves = months * 2;
  const manualLeaves = leaves
    .filter((l) => (l.leave_type === "Manual Credit" || l.leave_type === "Manual Deduction") && l.status === "Approved")
    .reduce((s, l) => s + l.days, 0);
  return automaticLeaves + manualLeaves;
}
// ---- end copy ----

// ---- Byte-for-byte copy of lib/leave.ts's splitElClOpeningBalance() ----
function splitElClOpeningBalance(total) {
  const el = Math.ceil(total / 2);
  const cl = total - el;
  return { el, cl };
}
// ---- end copy ----

(async () => {
  console.log("Seeding EL/CL opening balances (profiles columns only - no leave_requests rows will be created)...\n");

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id, full_name, date_of_joining, inactive_since, el_opening_balance, cl_opening_balance");
  if (profErr) throw profErr;

  const report = [];
  let seeded = 0, skippedAlready = 0, skippedZero = 0;

  for (const p of profiles) {
    if (p.el_opening_balance !== null || p.cl_opening_balance !== null) {
      skippedAlready++;
      continue;
    }

    const { data: leaves, error: leavesErr } = await admin
      .from("leave_requests")
      .select("days, status, leave_type")
      .eq("user_id", p.id);
    if (leavesErr) throw leavesErr;

    const totalAccrued = calculateAccruedLeaves(p.date_of_joining, leaves, p.inactive_since);
    const totalUsed = leaves
      .filter((l) => l.status === "Approved" && l.leave_type !== "Manual Credit" && l.leave_type !== "Manual Deduction")
      .reduce((s, l) => s + l.days, 0);
    const remaining = Math.max(0, totalAccrued - totalUsed);

    if (remaining <= 0) {
      skippedZero++;
      report.push({ name: p.full_name, before: remaining, el: 0, cl: 0, note: "zero balance - left both columns null" });
      continue;
    }

    const { el, cl } = splitElClOpeningBalance(remaining);

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ el_opening_balance: el, cl_opening_balance: cl })
      .eq("id", p.id);
    if (updateErr) throw updateErr;

    report.push({ name: p.full_name, before: remaining, el, cl, after: el + cl });
    console.log(`  ${p.full_name}: before=${remaining} -> EL=${el}, CL=${cl} (EL+CL=${el + cl})`);
    seeded++;
  }

  console.log(`\nDone. Seeded: ${seeded}, already had opening balances (skipped): ${skippedAlready}, zero balance (skipped, left null): ${skippedZero}.`);

  // --- Verification report: before vs after, EL+CL must equal before for every converted employee ---
  console.log("\n=== VERIFICATION: before vs EL+CL after, for every converted employee ===");
  let allMatch = true;
  report.forEach((r) => {
    if (r.after === undefined) return;
    const matches = Math.abs(r.before - r.after) < 1e-9;
    if (!matches) allMatch = false;
    console.log(`  ${matches ? "OK  " : "MISMATCH"} ${r.name}: before=${r.before}  EL=${r.el} CL=${r.cl}  EL+CL=${r.after}`);
  });
  console.log(allMatch ? "\nVERIFICATION PASSED: every converted employee's EL + CL equals their pre-conversion balance exactly." : "\nVERIFICATION FAILED - see MISMATCH rows above.");
})().catch((err) => {
  console.error("SEED SCRIPT FAILED:", err);
  process.exit(1);
});
