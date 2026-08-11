// One-time data migration: Firebase (Firestore + Storage + Auth) -> Supabase.
//
// Usage:
//   node scripts/migrate-to-supabase.mjs --dry-run   # read-only, prints what would happen
//   node scripts/migrate-to-supabase.mjs             # actually writes to Supabase
//
// Requires .env.local to have:
//   FIREBASE_SERVICE_ACCOUNT_PATH, NEXT_PUBLIC_SUPABASE_URL,
//   SUPABASE_SERVICE_ROLE_KEY, MIGRATION_TEMP_PASSWORD
// plus the existing NEXT_PUBLIC_FIREBASE_* vars are NOT used here — this
// script talks to Firebase via the Admin SDK (service account), not the
// client config.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env loading (no dotenv dependency — parse .env.local directly)
// ---------------------------------------------------------------------------
function loadEnvFile(file) {
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.join(process.cwd(), ".env.local"));

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 400;

// ---------------------------------------------------------------------------
// Init Firebase Admin
// ---------------------------------------------------------------------------
const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8")
);
const fbApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.appspot.com`,
});
const fdb = getFirestore(fbApp);
const fbucket = getStorage(fbApp).bucket();
const fauth = getAuth(fbApp);

// ---------------------------------------------------------------------------
// Init Supabase (service role — bypasses RLS entirely, as intended for
// a trusted, one-time server-side migration)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TEMP_PASSWORD = process.env.MIGRATION_TEMP_PASSWORD;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const stats = {};
function stat(name) {
  if (!stats[name]) stats[name] = { migrated: 0, skipped: 0, warnings: [] };
  return stats[name];
}

function tsToISO(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  if (typeof ts._seconds === "number") return new Date(ts._seconds * 1000).toISOString();
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function toDateOnly(value) {
  if (!value) return null;
  const iso = tsToISO(value);
  if (iso) return iso.slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

function normalizeName(n) {
  return (n || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

// Deterministic UUID (v5-like, sha1-based) so re-running the script upserts
// the same rows instead of duplicating them.
function deterministicUuid(namespace, id) {
  const hash = crypto.createHash("sha1").update(`${namespace}:${id}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function chunkedUpsert(table, rows, conflictTarget) {
  if (rows.length === 0) return { errors: [] };
  const errors = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, conflictTarget ? { onConflict: conflictTarget } : undefined);
    if (error) errors.push(error.message);
  }
  return { errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== Vectra ERP: Firebase -> Supabase migration ${DRY_RUN ? "(DRY RUN — no writes)" : "(LIVE)"} ===\n`);

  const uidMap = new Map(); // firebaseUid -> supabaseUuid
  const nameToUuid = new Map(); // normalized full_name -> supabaseUuid

  // -------------------------------------------------------------------------
  // 1. Users: "users" + legacy "Users" -> auth.users + profiles
  // -------------------------------------------------------------------------
  {
    const s = stat("profiles");
    const [usersSnap, legacySnap] = await Promise.all([
      fdb.collection("users").get(),
      fdb.collection("Users").get(),
    ]);

    const userDocs = new Map();
    legacySnap.forEach((d) => userDocs.set(d.id, d.data()));
    usersSnap.forEach((d) => userDocs.set(d.id, d.data())); // 'users' wins over legacy 'Users'

    console.log(`Found ${userDocs.size} user profiles (users: ${usersSnap.size}, legacy Users: ${legacySnap.size}).`);

    for (const [uid, data] of userDocs) {
      const email = (data.email || "").trim().toLowerCase();
      if (!email) {
        s.skipped++;
        s.warnings.push(`uid=${uid}: no email field, skipped entirely.`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] would create auth user ${email} (role=${data.role || "Employee"})`);
        s.migrated++;
        continue;
      }

      let newUserId;
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        password: TEMP_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: data.fullName || "",
          role: data.role || "Employee",
          employee_id: data.employeeId || null,
          job_role: data.jobRole || null,
          designation: data.designation || null,
          department: data.department || null,
        },
      });

      if (error) {
        // Re-run safety: if the user already exists, look it up instead of failing.
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = !listErr && list?.users?.find((u) => u.email?.toLowerCase() === email);
        if (existing) {
          newUserId = existing.id;
          s.warnings.push(`uid=${uid} email=${email}: already existed in Supabase, reused.`);
        } else {
          s.skipped++;
          s.warnings.push(`uid=${uid} email=${email}: FAILED to create — ${error.message}`);
          continue;
        }
      } else {
        newUserId = created.user.id;
      }

      uidMap.set(uid, newUserId);
      if (data.fullName) nameToUuid.set(normalizeName(data.fullName), newUserId);

      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          role: data.role || "Employee",
          employee_id: data.employeeId || null,
          job_role: data.jobRole || null,
          designation: data.designation || null,
          department: data.department || null,
          status: data.status || "Active",
          phone: data.phone || null,
          timezone: data.timezone || "Asia/Kolkata",
          notifications_email: data.notificationsEmail ?? true,
          notifications_leave: data.notificationsLeave ?? true,
          notifications_payroll: data.notificationsPayroll ?? true,
          aadhar: data.aadhar || null,
          pan: data.pan || null,
          bank_account_name: data.bankAccountName || null,
          bank_details: data.bankDetails || null,
          created_at: tsToISO(data.createdAt) || new Date().toISOString(),
        })
        .eq("id", newUserId);

      if (updErr) s.warnings.push(`uid=${uid}: profile follow-up update failed — ${updErr.message}`);
      s.migrated++;
    }

    console.log(`profiles: ${s.migrated} migrated, ${s.skipped} skipped.\n`);

    // -----------------------------------------------------------------------
    // 1b. Orphaned Firebase Auth accounts: real, active accounts that have
    // NO "users"/"Users" Firestore doc. Their historical data (attendance,
    // leave, payroll, etc.) is real and would otherwise be unattachable.
    // Create a minimal placeholder profile for each so that data migrates;
    // an Admin fixes up the real name/role/department afterward in-app.
    // -----------------------------------------------------------------------
    if (!DRY_RUN) {
      const so = stat("orphaned_auth_profiles");
      let allAuthUsers = [];
      let pageToken;
      do {
        const page = await fauth.listUsers(1000, pageToken);
        allAuthUsers = allAuthUsers.concat(page.users);
        pageToken = page.pageToken;
      } while (pageToken);

      const orphans = allAuthUsers.filter((u) => !userDocs.has(u.uid) && u.email);
      console.log(`Found ${orphans.length} Firebase Auth accounts with no Firestore profile doc.`);

      for (const u of orphans) {
        const email = u.email.trim().toLowerCase();
        const guessedName = email
          .split("@")[0]
          .replace(/[._]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        const { data: created, error } = await supabase.auth.admin.createUser({
          email,
          password: TEMP_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: guessedName, role: "Employee" },
        });

        let newUserId;
        if (error) {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = list?.users?.find((eu) => eu.email?.toLowerCase() === email);
          if (existing) {
            newUserId = existing.id;
            so.warnings.push(`firebase_uid=${u.uid} email=${email}: already existed in Supabase, reused.`);
          } else {
            so.skipped++;
            so.warnings.push(`firebase_uid=${u.uid} email=${email}: FAILED to create — ${error.message}`);
            continue;
          }
        } else {
          newUserId = created.user.id;
        }

        uidMap.set(u.uid, newUserId);
        nameToUuid.set(normalizeName(guessedName), newUserId);
        so.migrated++;
        so.warnings.push(`firebase_uid=${u.uid} email=${email}: created PLACEHOLDER profile (name="${guessedName}", role=Employee) — needs manual review.`);
      }

      console.log(`orphaned_auth_profiles: ${so.migrated} placeholder profiles created, ${so.skipped} skipped.\n`);
    }
  }

  if (DRY_RUN) {
    console.log("Dry run only migrates/maps users (needed to preview everything else accurately).");
    console.log("Re-run without --dry-run to perform the full migration.\n");
    printSummary();
    return;
  }

  // -------------------------------------------------------------------------
  // 2. attendance
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "attendance",
    table: "attendance",
    conflictTarget: "user_id,date",
    map: (id, d) => {
      const user_id = uidMap.get(d.userId);
      if (!user_id) return { skip: `attendance/${id}: unknown userId=${d.userId}` };
      return {
        row: {
          id: deterministicUuid("attendance", id),
          user_id,
          full_name: d.fullName || null,
          role: d.role || null,
          date: d.date,
          check_in_time: tsToISO(d.checkInTime),
          check_out_time: tsToISO(d.checkOutTime),
          status: d.status || "Present",
          working_seconds: d.workingSeconds || 0,
        },
      };
    },
  });

  // -------------------------------------------------------------------------
  // 3. leave_requests
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "leave_requests",
    table: "leave_requests",
    conflictTarget: "id",
    map: (id, d) => {
      const user_id = uidMap.get(d.userId);
      if (!user_id) return { skip: `leave_requests/${id}: unknown userId=${d.userId}` };
      return {
        row: {
          id: deterministicUuid("leave_requests", id),
          user_id,
          full_name: d.fullName || null,
          department: d.department || null,
          role: d.role || null,
          leave_type: d.leaveType || "Other",
          start_date: toDateOnly(d.startDate),
          end_date: toDateOnly(d.endDate),
          days: d.days || 0,
          reason: d.reason || null,
          status: d.status || "Pending",
          applied_on: tsToISO(d.appliedOn) || new Date().toISOString(),
        },
      };
    },
  });

  // -------------------------------------------------------------------------
  // 4. salary_structures (doc id = userId, natural PK)
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "salary_structures",
    table: "salary_structures",
    conflictTarget: "user_id",
    map: (id, d) => {
      const user_id = uidMap.get(id);
      if (!user_id) return { skip: `salary_structures/${id}: unknown userId=${id}` };
      return {
        row: {
          user_id,
          gross_salary: d.grossSalary || 0,
          travel_allowance: d.travelAllowance || 0,
          other_deductions: d.otherDeductions || 0,
          other_allowances: d.otherAllowances || 0,
          updated_at: tsToISO(d.updatedAt) || new Date().toISOString(),
        },
      };
    },
  });

  // -------------------------------------------------------------------------
  // 5. payrolls
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "payrolls",
    table: "payrolls",
    conflictTarget: "user_id,year,month",
    map: (id, d) => {
      const user_id = uidMap.get(d.userId);
      if (!user_id) return { skip: `payrolls/${id}: unknown userId=${d.userId}` };
      return {
        row: {
          id: deterministicUuid("payrolls", id),
          user_id,
          employee_name: d.employeeName || null,
          employee_id: d.employeeId || null,
          job_role: d.jobRole || null,
          department: d.department || null,
          date_of_joining: toDateOnly(d.dateOfJoining),
          bank_name: d.bankName || null,
          division: d.division || null,
          days_worked: d.daysWorked || null,
          month: d.month,
          year: d.year,
          gross_salary: d.grossSalary || 0,
          basic: d.basic || 0,
          hra: d.hra || 0,
          travel_allowance: d.travelAllowance || 0,
          special_allowance: d.specialAllowance || 0,
          other_allowances: d.otherAllowances || 0,
          incentives: d.incentives || 0,
          total_earnings: d.totalEarnings || 0,
          lop_days: d.lopDays || 0,
          lop_deduction: d.lopDeduction || 0,
          tax_deduction: d.taxDeduction || 0,
          income_tax: d.incomeTax || 0,
          provident_fund: d.providentFund || 0,
          other_deductions: d.otherDeductions || 0,
          total_deductions: d.totalDeductions || 0,
          net_salary: d.netSalary || 0,
          payment_date: toDateOnly(d.paymentDate),
          mode_of_payment: d.modeOfPayment || null,
          generated_at: tsToISO(d.generatedAt) || new Date().toISOString(),
          status: d.status || "Pending",
        },
      };
    },
  });

  // -------------------------------------------------------------------------
  // 6. announcements
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "announcements",
    table: "announcements",
    conflictTarget: "id",
    map: (id, d) => ({
      row: {
        id: deterministicUuid("announcements", id),
        title: d.title || "",
        body: d.body || null,
        author: uidMap.get(d.author) || null,
        author_name: d.authorName || null,
        pinned: !!d.pinned,
        archived: !!d.archived,
        created_at: tsToISO(d.createdAt) || new Date().toISOString(),
      },
    }),
  });

  // -------------------------------------------------------------------------
  // 7. documents — metadata + actual file transfer Storage -> Storage
  // -------------------------------------------------------------------------
  {
    const s = stat("documents");
    const snap = await fdb.collection("documents").get();
    console.log(`documents: found ${snap.size} records.`);
    const rows = [];

    for (const doc of snap.docs) {
      const d = doc.data();
      const uploaded_by = uidMap.get(d.uploadedBy);
      if (!uploaded_by) {
        s.skipped++;
        s.warnings.push(`documents/${doc.id}: unknown uploadedBy=${d.uploadedBy}, skipped.`);
        continue;
      }
      if (!d.storagePath) {
        s.skipped++;
        s.warnings.push(`documents/${doc.id}: no storagePath, skipped.`);
        continue;
      }

      const scope = d.scope === "company" ? "company" : "personal";
      const fileName = d.storagePath.split("/").pop();
      const newStoragePath = `${scope}/${uploaded_by}/${fileName}`;

      try {
        const [buffer] = await fbucket.file(d.storagePath).download();
        const { error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(newStoragePath, buffer, { upsert: true });
        if (uploadErr) {
          s.warnings.push(`documents/${doc.id}: storage upload failed — ${uploadErr.message}`);
          continue;
        }
      } catch (e) {
        s.warnings.push(`documents/${doc.id}: could not download from Firebase Storage — ${e.message}`);
        continue;
      }

      rows.push({
        id: deterministicUuid("documents", doc.id),
        name: d.name || fileName,
        type: d.type || null,
        size: d.size || null,
        status: d.status || "Pending Review",
        scope,
        uploaded_by,
        uploaded_by_name: d.uploadedByName || null,
        uploaded_at: tsToISO(d.uploadedAt) || new Date().toISOString(),
        storage_url: null, // bucket is private now; app generates signed URLs on demand
        storage_path: newStoragePath,
      });
      s.migrated++;
    }

    const { errors } = await chunkedUpsert("documents", rows, "id");
    errors.forEach((e) => s.warnings.push(`documents upsert error: ${e}`));
    console.log(`documents: ${s.migrated} migrated (file + row), ${s.skipped} skipped.\n`);
  }

  // -------------------------------------------------------------------------
  // 8. notifications
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "notifications",
    table: "notifications",
    conflictTarget: "id",
    map: (id, d) => {
      const user_id = uidMap.get(d.userId);
      if (!user_id) return { skip: `notifications/${id}: unknown userId=${d.userId}` };
      return {
        row: {
          id: deterministicUuid("notifications", id),
          user_id,
          message: d.message || "",
          type: d.type || "general",
          read: !!d.read,
          created_at: tsToISO(d.createdAt) || new Date().toISOString(),
        },
      };
    },
  });

  // -------------------------------------------------------------------------
  // 9. audit_logs
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "audit_logs",
    table: "audit_logs",
    conflictTarget: "id",
    map: (id, d) => ({
      row: {
        id: deterministicUuid("audit_logs", id),
        actor_name: d.actorName || null,
        actor_uid: uidMap.get(d.actorUid) || null,
        action: d.action || "",
        target: d.target || null,
        details: d.details || null,
        created_at: tsToISO(d.createdAt) || new Date().toISOString(),
      },
    }),
  });

  // -------------------------------------------------------------------------
  // 10. sales
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "sales",
    table: "sales",
    conflictTarget: "id",
    map: (id, d) => {
      const matchedUid =
        uidMap.get(d.userId) || nameToUuid.get(normalizeName(d["Internal Name"])) || null;
      return {
        row: {
          id: deterministicUuid("sales", id),
          date: toDateOnly(d["Date"]),
          candidate_name: d["Candidate Name "] || d["Candidate Name"] || null,
          contact_number: d["Contact Number"] || null,
          email: d["Email"] || null,
          visa_status: d["Visa Status"] || null,
          job_role: d["Job Role"] || null,
          experience: d["Exp"] || null,
          location: d["Location"] || null,
          internal_name: d["Internal Name"] || null,
          linkedin_url: d["Linkedln Profile URL"] || d["LinkedIn Profile URL"] || null,
          feedback: d["Feedback"] || null,
          status: d["Status"] || "New",
          created_by: matchedUid,
          created_at: tsToISO(d.createdAt) || new Date().toISOString(),
        },
      };
    },
  });

  // -------------------------------------------------------------------------
  // 11. marketing
  // -------------------------------------------------------------------------
  await migrateCollection({
    firestoreCollection: "marketing",
    table: "marketing",
    conflictTarget: "id",
    map: (id, d) => {
      const matchedUid =
        uidMap.get(d.userId) || nameToUuid.get(normalizeName(d["marketing"])) || null;
      return {
        row: {
          id: deterministicUuid("marketing", id),
          candidate_name: d["Name"] || null,
          date: toDateOnly(d["Date"]),
          company_name: d["Company Name"] || null,
          link: d["Link"] || null,
          created_by: matchedUid,
          created_by_name: d["marketing"] || null,
          created_at: tsToISO(d.createdAt) || new Date().toISOString(),
        },
      };
    },
  });

  printSummary();

  // ---------------------------------------------------------------------------
  async function migrateCollection({ firestoreCollection, table, conflictTarget, map }) {
    const s = stat(table);
    const snap = await fdb.collection(firestoreCollection).get();
    console.log(`${table}: found ${snap.size} records in Firestore "${firestoreCollection}".`);

    const rows = [];
    for (const doc of snap.docs) {
      const result = map(doc.id, doc.data());
      if (result.skip) {
        s.skipped++;
        s.warnings.push(result.skip);
        continue;
      }
      rows.push(result.row);
      s.migrated++;
    }

    const { errors } = await chunkedUpsert(table, rows, conflictTarget);
    errors.forEach((e) => s.warnings.push(`${table} upsert error: ${e}`));

    console.log(`${table}: ${s.migrated} migrated, ${s.skipped} skipped.\n`);
  }

  function printSummary() {
    console.log("\n=== Migration summary ===");
    for (const [name, s] of Object.entries(stats)) {
      console.log(`${name}: ${s.migrated} migrated, ${s.skipped} skipped, ${s.warnings.length} warnings`);
    }
    const reportPath = path.join(process.cwd(), "scripts", "migration-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`\nFull report (including all warnings) written to: ${reportPath}`);
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
