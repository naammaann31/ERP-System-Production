/**
 * Regression suite for the Clock In/Clock Out decision rules in
 * lib/attendance.ts — determineCheckInFlags, determineCheckOutHalfDay,
 * isImmigrationWeekOffDate.
 *
 * This is the documented behavior baseline from the audit (see chat
 * history, "Clock In/Clock Out Server-Authoritative Migration" audit).
 * Any server-side (SQL/RPC) reimplementation of these rules must produce
 * identical results for every case below before it's trusted to replace
 * the client-side logic.
 *
 * Run: node test-attendance-rules.ts   (Node 22+, native TS type-stripping)
 */
import {
  determineCheckInFlags,
  determineCheckOutHalfDay,
  isImmigrationWeekOffDate,
} from "./lib/attendanceRules.ts";

type Case<T> = { name: string; input: T; expected: any; actual?: any; pass?: boolean };

let total = 0;
let failed = 0;

function run<T>(cases: Case<T>[], fn: (input: T) => any) {
  for (const c of cases) {
    total++;
    c.actual = fn(c.input);
    c.pass = JSON.stringify(c.actual) === JSON.stringify(c.expected);
    if (!c.pass) failed++;
    const status = c.pass ? "PASS" : "FAIL";
    console.log(
      `[${status}] ${c.name} — expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(c.actual)}`
    );
  }
}

// ============================================================
// isImmigrationWeekOffDate — Sunday, or 4th Saturday (date 22-28)
// ============================================================
console.log("\n=== isImmigrationWeekOffDate ===");
run(
  [
    // October 2026: 1=Thu, 4=Sun, 10=Sat(2nd), 17=Sat(3rd), 24=Sat(4th), 25=Sun, 31=Sat(5th)
    { name: "Sunday (Oct 4, 2026)", input: { y: 2026, m: 10, d: 4 }, expected: true },
    { name: "Sunday, 4th-Sat week (Oct 25, 2026)", input: { y: 2026, m: 10, d: 25 }, expected: true },
    { name: "2nd Saturday (Oct 10, 2026) — not week off", input: { y: 2026, m: 10, d: 10 }, expected: false },
    { name: "3rd Saturday (Oct 17, 2026) — not week off", input: { y: 2026, m: 10, d: 17 }, expected: false },
    { name: "The 4th Saturday itself (Oct 24, 2026) — week off", input: { y: 2026, m: 10, d: 24 }, expected: true },
    { name: "Thursday within the 22-28 date-number range (Oct 22) — range alone isn't enough, must also be a Saturday", input: { y: 2026, m: 10, d: 22 }, expected: false },
    { name: "3rd Saturday, just before the 22-28 range (Oct 17) — not week off", input: { y: 2026, m: 10, d: 17 }, expected: false },
    { name: "Wednesday within the 22-28 date-number range (Oct 28) — not a Saturday, not week off", input: { y: 2026, m: 10, d: 28 }, expected: false },
    { name: "5th Saturday, just after the 22-28 range (Oct 31) — not week off", input: { y: 2026, m: 10, d: 31 }, expected: false },
    { name: "Ordinary weekday (Oct 19, 2026, Monday) — not week off", input: { y: 2026, m: 10, d: 19 }, expected: false },
  ],
  (i) => isImmigrationWeekOffDate(i.y, i.m, i.d)
);

// ============================================================
// determineCheckInFlags — Regular / Night Shift
// ============================================================
console.log("\n=== determineCheckInFlags: Regular shift ===");
run(
  [
    { name: "On-time, mid-shift (7:00 PM)", input: { h: 19, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "Exactly 7:45 PM — not late (boundary is > 7:45)", input: { h: 19, m: 45 }, expected: { isLate: false, isAbsent: false } },
    { name: "7:46 PM — late", input: { h: 19, m: 46 }, expected: { isLate: true, isAbsent: false } },
    { name: "8:00 PM (hour > 19) — late", input: { h: 20, m: 0 }, expected: { isLate: true, isAbsent: false } },
    { name: "Exactly 6:00 AM — on time, not late, not absent (boundary is < 6)", input: { h: 6, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "5:59 AM — late AND absent", input: { h: 5, m: 59 }, expected: { isLate: true, isAbsent: true } },
    { name: "Midnight 12:00 AM — late AND absent", input: { h: 0, m: 0 }, expected: { isLate: true, isAbsent: true } },
    { name: "3:00 AM — late AND absent", input: { h: 3, m: 0 }, expected: { isLate: true, isAbsent: true } },
    { name: "Noon (unusual but valid input) — not late", input: { h: 12, m: 0 }, expected: { isLate: false, isAbsent: false } },
  ],
  (i) => determineCheckInFlags(i.h, i.m, false, false)
);

console.log("\n=== determineCheckInFlags: Immigration shift (not a week off) ===");
run(
  [
    { name: "On-time (9:00 AM)", input: { h: 9, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "Exactly 10:15 AM — not late (boundary is > 10:15)", input: { h: 10, m: 15 }, expected: { isLate: false, isAbsent: false } },
    { name: "10:16 AM — late", input: { h: 10, m: 16 }, expected: { isLate: true, isAbsent: false } },
    { name: "11:00 AM (hour > 10) — late", input: { h: 11, m: 0 }, expected: { isLate: true, isAbsent: false } },
    { name: "Very early check-in (2:00 AM) — Immigration never marks absent at check-in", input: { h: 2, m: 0 }, expected: { isLate: false, isAbsent: false } },
  ],
  (i) => determineCheckInFlags(i.h, i.m, true, false)
);

console.log("\n=== determineCheckInFlags: Immigration shift, ON a week off ===");
run(
  [
    { name: "Would-be-late time (11:00 AM) on a week off — late suppressed entirely", input: { h: 11, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "On-time-looking check-in on a week off — still not late", input: { h: 9, m: 0 }, expected: { isLate: false, isAbsent: false } },
  ],
  (i) => determineCheckInFlags(i.h, i.m, true, true)
);

// ============================================================
// determineCheckOutHalfDay
// ============================================================
console.log("\n=== determineCheckOutHalfDay ===");
const H = 3600;
run(
  [
    { name: "Worked 4h59m59s (just under 5h), regular — half day", input: { secs: 5 * H - 1, imm: false, wo: false }, expected: true },
    { name: "Worked exactly 5h, regular — NOT half day (boundary is < 5h)", input: { secs: 5 * H, imm: false, wo: false }, expected: false },
    { name: "Worked 5h1s, regular — not half day", input: { secs: 5 * H + 1, imm: false, wo: false }, expected: false },
    { name: "Worked 0s, regular — half day", input: { secs: 0, imm: false, wo: false }, expected: true },
    { name: "Worked 2h, Immigration, NOT a week off — half day", input: { secs: 2 * H, imm: true, wo: false }, expected: true },
    { name: "Worked 2h, Immigration, ON a week off — exemption applies, NOT half day", input: { secs: 2 * H, imm: true, wo: true }, expected: false },
    { name: "Worked 2h, regular shift, week-off flag irrelevant (regular never gets the exemption)", input: { secs: 2 * H, imm: false, wo: true }, expected: true },
    { name: "Worked full 9h — never half day regardless of role/week-off", input: { secs: 9 * H, imm: true, wo: true }, expected: false },
  ],
  (i) => determineCheckOutHalfDay(i.secs, i.imm, i.wo)
);

// ============================================================
console.log(`\n${total - failed}/${total} passed.`);
if (failed > 0) {
  console.log(`${failed} FAILED — see [FAIL] lines above.`);
  process.exit(1);
}
console.log("All rules match the documented baseline.");
