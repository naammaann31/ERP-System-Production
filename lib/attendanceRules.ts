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
