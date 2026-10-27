/**
 * Pure attendance business-rule functions — no Supabase, no imports, no
 * side effects. Deliberately kept dependency-free so they can be unit
 * tested directly with plain Node (see test-attendance-rules.ts), and so
 * a future server-side (SQL) implementation has one unambiguous,
 * standalone spec to be checked against.
 *
 * Moved out of lib/attendance.ts as a structural-only change — every
 * branch and threshold below is copied verbatim from the original inline
 * logic; nothing here changes behavior.
 */

/**
 * Is this IST calendar date an Immigration-shift week off?
 *
 * Sunday, or the 4th Saturday of the month (date 22-28 inclusive). Built
 * from explicit Y/M/D numbers via Date.UTC + the UTC getters — never from
 * parsing a date STRING with the local getters — so the answer is the same
 * regardless of which timezone the calling machine (browser or server) is
 * set to.
 */
export function isImmigrationWeekOffDate(year: number, month1Indexed: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month1Indexed - 1, day));
  const dayOfWeek = d.getUTCDay();
  const dateNum = d.getUTCDate();
  return dayOfWeek === 0 || (dayOfWeek === 6 && dateNum >= 22 && dateNum <= 28);
}

export interface CheckInFlags {
  isLate: boolean;
  isAbsent: boolean;
}

/**
 * Pure decision logic for what a check-in at this IST hour/minute means.
 */
export function determineCheckInFlags(
  hour: number,
  minute: number,
  isImmigration: boolean,
  isWeekOff: boolean
): CheckInFlags {
  if (isImmigration) {
    let isLate = false;
    if (!isWeekOff) {
      // Late Comer Logic: Immigration shift starts at 10:00 AM, late if strictly > 10:15 AM
      if (hour > 10 || (hour === 10 && minute > 15)) {
        isLate = true;
      }
    }
    // Absent logic is handled strictly by the Cron (auto-clockout) for Immigration.
    return { isLate, isAbsent: false };
  }

  // Existing Night Shift logic
  let isLate = false;
  let isAbsent = false;

  // Late Comer Logic: Clock in after 7:45 PM or between 12:00 AM and 6:00 AM
  if (hour > 19 || (hour === 19 && minute > 45) || hour < 6) {
    isLate = true;
  }

  // Absent Logic: If user clocks in after 11:59 PM (between 12:00 AM and 6:00 AM)
  if (hour < 6) {
    isAbsent = true;
  }

  return { isLate, isAbsent };
}

/**
 * Pure decision logic for checkOut()'s half-day penalty.
 */
export function determineCheckOutHalfDay(
  workingSeconds: number,
  isImmigration: boolean,
  isWeekOff: boolean
): boolean {
  // Early Leaver Penalty: If total hours < 5 (18,000 seconds), mark as half day.
  if (workingSeconds >= 5 * 3600) return false;
  // Exception: Do not penalize if it's a Week Off for Immigration
  if (isImmigration && isWeekOff) return false;
  return true;
}

/**
 * Fully generic form, parameterized by a shift's own rule fields (mirrors
 * the `shifts` table, migration 00000000000035) instead of a hardcoded
 * Immigration/Night-Shift boolean split. This is the independent spec the
 * generic SQL clock_in()/clock_out() logic is checked against — the two
 * functions above are deliberately left untouched (still exactly what the
 * dead checkIn()/checkOut() client functions use) so nothing that already
 * worked can regress; this is new, additive logic for the 3-shift system.
 */
export interface ShiftRuleConfig {
  lateAfterHour: number;
  lateAfterMinute: number;
  hasEarlyAbsentTrigger: boolean;
  earlyAbsentBeforeHour: number | null;
  weekOffAffectsRules: boolean;
  halfDayThresholdSeconds: number;
}

export function determineCheckInFlagsForShift(
  hour: number,
  minute: number,
  shift: ShiftRuleConfig,
  isWeekOff: boolean
): CheckInFlags {
  if (shift.hasEarlyAbsentTrigger && shift.earlyAbsentBeforeHour !== null && hour < shift.earlyAbsentBeforeHour) {
    return { isLate: true, isAbsent: true };
  }
  if (shift.weekOffAffectsRules && isWeekOff) {
    return { isLate: false, isAbsent: false };
  }
  const isLate = hour > shift.lateAfterHour || (hour === shift.lateAfterHour && minute > shift.lateAfterMinute);
  return { isLate, isAbsent: false };
}

export function determineCheckOutHalfDayForShift(
  workingSeconds: number,
  shift: Pick<ShiftRuleConfig, "weekOffAffectsRules" | "halfDayThresholdSeconds">,
  isWeekOff: boolean
): boolean {
  if (workingSeconds >= shift.halfDayThresholdSeconds) return false;
  if (shift.weekOffAffectsRules && isWeekOff) return false;
  return true;
}

/**
 * Generalized form of isImmigrationWeekOffDate() above — parameterized by
 * a shift's own week-off rule instead of being hardcoded to Immigration.
 * Built from explicit Y/M/D numbers via Date.UTC + UTC getters (never from
 * parsing a date STRING with local getters), so the answer is the same
 * regardless of which timezone the calling machine is set to.
 *
 * "sunday_plus_last_saturday" is the true last Saturday of the month, NOT
 * the 4th Saturday by date-range — those are only the same thing in months
 * with exactly 4 Saturdays. A month whose 1st Saturday falls on the 1st,
 * 2nd, or 3rd has a 5th Saturday, which a date-range-22-28 check would
 * never recognize (e.g. October 2026: Saturdays fall on 3, 10, 17, 24, 31
 * — the 31st is the real last Saturday, not the 24th).
 */
export function isWeekOffForRule(
  rule: "standard_weekend" | "sunday_plus_last_saturday",
  year: number,
  month1Indexed: number,
  day: number
): boolean {
  const d = new Date(Date.UTC(year, month1Indexed - 1, day));
  const dayOfWeek = d.getUTCDay();

  if (dayOfWeek === 0) return true;
  if (dayOfWeek !== 6) return false;
  if (rule === "standard_weekend") return true;

  // sunday_plus_last_saturday: true only if adding 7 days rolls into the
  // next calendar month (works across year boundaries too, since only the
  // month index is compared).
  const nextWeek = new Date(Date.UTC(year, month1Indexed - 1, day + 7));
  return nextWeek.getUTCMonth() !== (month1Indexed - 1);
}

/** Which shift an employee is on, by role/designation — pre-shift-table legacy inference, used only as a fallback if a profile somehow has no shift_id (should not happen after the migration 35 backfill). */
export function legacyIsImmigration(role?: string | null, designation?: string | null): boolean {
  return role === "IMMIGRATION" || designation === "Immigration HR";
}
