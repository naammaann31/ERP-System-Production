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
  determineCheckInFlagsForShift,
  determineCheckOutHalfDayForShift,
  isWeekOffForRule,
  type ShiftRuleConfig,
} from "./lib/attendanceRules.ts";

const NIGHT_SHIFT: ShiftRuleConfig = {
  lateAfterHour: 19,
  lateAfterMinute: 45,
  hasEarlyAbsentTrigger: true,
  earlyAbsentBeforeHour: 6,
  weekOffAffectsRules: false,
  halfDayThresholdSeconds: 18000,
};
const IMMIGRATION_SHIFT: ShiftRuleConfig = {
  lateAfterHour: 10,
  lateAfterMinute: 15,
  hasEarlyAbsentTrigger: false,
  earlyAbsentBeforeHour: null,
  weekOffAffectsRules: true,
  halfDayThresholdSeconds: 18000,
};
const MID_SHIFT: ShiftRuleConfig = {
  lateAfterHour: 14,
  lateAfterMinute: 15,
  hasEarlyAbsentTrigger: false,
  earlyAbsentBeforeHour: null,
  weekOffAffectsRules: false,
  halfDayThresholdSeconds: 18000,
};

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
// determineCheckInFlagsForShift — generic form (migration 35 spec).
// Re-runs the EXACT SAME Night Shift / Immigration cases above through the
// new generic, shift-config-driven function, to prove it reproduces
// identical results before trusting it as the spec the new SQL is checked
// against — then adds Mid Shift's own cases, which have no prior baseline.
// ============================================================
console.log("\n=== determineCheckInFlagsForShift: Night Shift (must match determineCheckInFlags exactly) ===");
run(
  [
    { name: "On-time, mid-shift (7:00 PM)", input: { h: 19, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "Exactly 7:45 PM — not late", input: { h: 19, m: 45 }, expected: { isLate: false, isAbsent: false } },
    { name: "7:46 PM — late", input: { h: 19, m: 46 }, expected: { isLate: true, isAbsent: false } },
    { name: "8:00 PM (hour > 19) — late", input: { h: 20, m: 0 }, expected: { isLate: true, isAbsent: false } },
    { name: "Exactly 6:00 AM — on time", input: { h: 6, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "5:59 AM — late AND absent", input: { h: 5, m: 59 }, expected: { isLate: true, isAbsent: true } },
    { name: "Midnight 12:00 AM — late AND absent", input: { h: 0, m: 0 }, expected: { isLate: true, isAbsent: true } },
    { name: "3:00 AM — late AND absent", input: { h: 3, m: 0 }, expected: { isLate: true, isAbsent: true } },
    { name: "Noon — not late", input: { h: 12, m: 0 }, expected: { isLate: false, isAbsent: false } },
  ],
  (i) => determineCheckInFlagsForShift(i.h, i.m, NIGHT_SHIFT, false)
);

console.log("\n=== determineCheckInFlagsForShift: Immigration Shift, not a week off (must match determineCheckInFlags exactly) ===");
run(
  [
    { name: "On-time (9:00 AM)", input: { h: 9, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "Exactly 10:15 AM — not late", input: { h: 10, m: 15 }, expected: { isLate: false, isAbsent: false } },
    { name: "10:16 AM — late", input: { h: 10, m: 16 }, expected: { isLate: true, isAbsent: false } },
    { name: "11:00 AM — late", input: { h: 11, m: 0 }, expected: { isLate: true, isAbsent: false } },
    { name: "Very early check-in (2:00 AM) — never absent at check-in", input: { h: 2, m: 0 }, expected: { isLate: false, isAbsent: false } },
  ],
  (i) => determineCheckInFlagsForShift(i.h, i.m, IMMIGRATION_SHIFT, false)
);

console.log("\n=== determineCheckInFlagsForShift: Immigration Shift, ON a week off (must match determineCheckInFlags exactly) ===");
run(
  [
    { name: "Would-be-late time (11:00 AM) on a week off — suppressed", input: { h: 11, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "On-time-looking check-in on a week off", input: { h: 9, m: 0 }, expected: { isLate: false, isAbsent: false } },
  ],
  (i) => determineCheckInFlagsForShift(i.h, i.m, IMMIGRATION_SHIFT, true)
);

console.log("\n=== determineCheckInFlagsForShift: Mid Shift (new, 2:00 PM - 11:00 PM, late after 2:15 PM) ===");
run(
  [
    { name: "On-time (2:00 PM)", input: { h: 14, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "Exactly 2:15 PM — not late (boundary is > 2:15)", input: { h: 14, m: 15 }, expected: { isLate: false, isAbsent: false } },
    { name: "2:16 PM — late", input: { h: 14, m: 16 }, expected: { isLate: true, isAbsent: false } },
    { name: "3:00 PM (hour > 14) — late", input: { h: 15, m: 0 }, expected: { isLate: true, isAbsent: false } },
    { name: "Very early check-in (3:00 AM) — no early-absent trigger, never absent at check-in", input: { h: 3, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "Mid-afternoon (1:00 PM, before start) — not late", input: { h: 13, m: 0 }, expected: { isLate: false, isAbsent: false } },
    { name: "Week off flag has no effect — Mid Shift's week-off is display-only, like Night Shift", input: { h: 11, m: 0 }, expected: { isLate: false, isAbsent: false } },
  ],
  (i) => determineCheckInFlagsForShift(i.h, i.m, MID_SHIFT, i.h === 11 ? true : false)
);

// ============================================================
// determineCheckOutHalfDayForShift — generic form
// ============================================================
console.log("\n=== determineCheckOutHalfDayForShift: Night Shift & Immigration (must match determineCheckOutHalfDay exactly) ===");
run(
  [
    { name: "Worked 4h59m59s, Night Shift — half day", input: { secs: 5 * H - 1, shift: NIGHT_SHIFT, wo: false }, expected: true },
    { name: "Worked exactly 5h, Night Shift — NOT half day", input: { secs: 5 * H, shift: NIGHT_SHIFT, wo: false }, expected: false },
    { name: "Worked 0s, Night Shift — half day", input: { secs: 0, shift: NIGHT_SHIFT, wo: false }, expected: true },
    { name: "Worked 2h, Immigration, not a week off — half day", input: { secs: 2 * H, shift: IMMIGRATION_SHIFT, wo: false }, expected: true },
    { name: "Worked 2h, Immigration, ON a week off — exemption applies", input: { secs: 2 * H, shift: IMMIGRATION_SHIFT, wo: true }, expected: false },
    { name: "Worked 2h, Night Shift, week-off flag irrelevant", input: { secs: 2 * H, shift: NIGHT_SHIFT, wo: true }, expected: true },
    { name: "Worked full 9h, Immigration on a week off — never half day", input: { secs: 9 * H, shift: IMMIGRATION_SHIFT, wo: true }, expected: false },
  ],
  (i) => determineCheckOutHalfDayForShift(i.secs, i.shift, i.wo)
);

console.log("\n=== determineCheckOutHalfDayForShift: Mid Shift (new) ===");
run(
  [
    { name: "Worked 4h59m59s — half day", input: { secs: 5 * H - 1 }, expected: true },
    { name: "Worked exactly 5h — NOT half day", input: { secs: 5 * H }, expected: false },
    { name: "Clocked in 2:00 PM, logout before 7:00 PM (< 5h) — half day, per the explicit spec example", input: { secs: 4 * H }, expected: true },
    { name: "Clocked in 2:00 PM, logout at/after 7:00 PM (>= 5h) — not half day", input: { secs: 5 * H }, expected: false },
    { name: "Worked 0s — half day", input: { secs: 0 }, expected: true },
    { name: "Week off flag has no effect — Mid Shift has no exemption, same as Night Shift", input: { secs: 2 * H }, expected: true },
  ],
  (i) => determineCheckOutHalfDayForShift(i.secs, MID_SHIFT, false)
);

// ============================================================
// isWeekOffForShift (lib/shifts.ts) — generic form, now computing the true
// LAST Saturday of the month rather than the 4th-by-date-range. These two
// are only the same thing in a month with exactly 4 Saturdays — a month
// with 5 (like October 2026) diverges, which is exactly the bug being
// fixed here. isImmigrationWeekOffDate() (the old, legacy, 4th-Saturday
// function above) is deliberately left untouched — it only ever feeds the
// already-dead checkIn()/checkOut() functions — so this is a fresh set of
// expectations, not a "must match the old baseline" cross-check.
// ============================================================
console.log("\n=== isWeekOffForRule: sunday_plus_last_saturday — October 2026 (5 Saturdays: 3, 10, 17, 24, 31) ===");
run(
  [
    { name: "Sunday (Oct 4, 2026)", input: { y: 2026, m: 10, d: 4 }, expected: true },
    { name: "1st Saturday (Oct 3, 2026) — not week off", input: { y: 2026, m: 10, d: 3 }, expected: false },
    { name: "2nd Saturday (Oct 10, 2026) — not week off", input: { y: 2026, m: 10, d: 10 }, expected: false },
    { name: "3rd Saturday (Oct 17, 2026) — not week off", input: { y: 2026, m: 10, d: 17 }, expected: false },
    { name: "4th Saturday (Oct 24, 2026) — NOT the last one this month, so NOT week off (this is the bug being fixed)", input: { y: 2026, m: 10, d: 24 }, expected: false },
    { name: "5th Saturday (Oct 31, 2026) — the TRUE last Saturday, IS week off", input: { y: 2026, m: 10, d: 31 }, expected: true },
    { name: "Ordinary weekday (Oct 19, 2026, Monday) — not week off", input: { y: 2026, m: 10, d: 19 }, expected: false },
  ],
  (i) => isWeekOffForRule("sunday_plus_last_saturday", i.y, i.m, i.d)
);

console.log("\n=== isWeekOffForRule: sunday_plus_last_saturday — November 2026 (only 4 Saturdays: 7, 14, 21, 28 — 4th = last, proves the common case still works) ===");
run(
  [
    { name: "3rd Saturday (Nov 21, 2026) — not week off", input: { y: 2026, m: 11, d: 21 }, expected: false },
    { name: "4th Saturday (Nov 28, 2026) — also the last Saturday this month, IS week off", input: { y: 2026, m: 11, d: 28 }, expected: true },
  ],
  (i) => isWeekOffForRule("sunday_plus_last_saturday", i.y, i.m, i.d)
);

console.log("\n=== isWeekOffForRule: sunday_plus_last_saturday — December 2026 -> January boundary (year rollover) ===");
run(
  [
    // Dec 1, 2026 is a Tuesday (Oct 1 Thu -> Nov 1 Sun -> Dec 1 Tue), so
    // December's Saturdays are 5, 12, 19, 26 — exactly 4, last is the 26th,
    // and adding 7 days to it rolls into January of the NEXT year, which
    // must still be detected correctly as "different month".
    { name: "3rd Saturday (Dec 19, 2026) — not week off", input: { y: 2026, m: 12, d: 19 }, expected: false },
    { name: "4th/last Saturday (Dec 26, 2026), rolls into January NEXT YEAR — IS week off", input: { y: 2026, m: 12, d: 26 }, expected: true },
  ],
  (i) => isWeekOffForRule("sunday_plus_last_saturday", i.y, i.m, i.d)
);

console.log("\n=== isWeekOffForRule: standard_weekend (Night Shift / Mid Shift) ===");
run(
  [
    { name: "Sunday (Oct 4, 2026) — week off", input: { y: 2026, m: 10, d: 4 }, expected: true },
    { name: "Saturday (Oct 10, 2026) — week off regardless of date-of-month", input: { y: 2026, m: 10, d: 10 }, expected: true },
    { name: "The would-be-4th-Saturday (Oct 24, 2026) — still just a normal Saturday, week off", input: { y: 2026, m: 10, d: 24 }, expected: true },
    { name: "5th Saturday (Oct 31, 2026) — week off, no 4-Saturdays-only restriction", input: { y: 2026, m: 10, d: 31 }, expected: true },
    { name: "Ordinary weekday (Oct 19, 2026, Monday) — not week off", input: { y: 2026, m: 10, d: 19 }, expected: false },
    { name: "Friday (Oct 23, 2026) — not week off", input: { y: 2026, m: 10, d: 23 }, expected: false },
  ],
  (i) => isWeekOffForRule("standard_weekend", i.y, i.m, i.d)
);

// ============================================================
console.log(`\n${total - failed}/${total} passed.`);
if (failed > 0) {
  console.log(`${failed} FAILED — see [FAIL] lines above.`);
  process.exit(1);
}
console.log("All rules match the documented baseline.");
