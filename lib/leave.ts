import { createClient } from "@/lib/supabase/client";

// `leave_requests.start_date`/`end_date` are plain Postgres `date` columns
// ("YYYY-MM-DD", no time, no timezone). Handing a bare date-only string
// straight to `new Date(str)` is a real trap: the JS spec parses that as
// UTC MIDNIGHT, so any later local-timezone read of it (toLocaleDateString,
// getMonth/getDate without a pinned timeZone) renders a day EARLIER on any
// viewer whose device timezone isn't at or ahead of UTC - confirmed root
// cause of a real incident (an employee's own leave date displaying one
// day before what HR's dashboard - and the database - actually show for
// the exact same row). Every date-only value in this module must go
// through one of the two helpers below instead of `new Date(dateOnlyStr)`
// directly, so the calendar day shown is invariant to the viewer's device.
function parseDateOnly(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || "");
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** A local-timezone Date for a "YYYY-MM-DD" string's exact calendar day - safe for getMonth()/getDate()/getFullYear() comparisons, never shifted by UTC parsing. */
export function dateOnlyToLocalDate(dateStr: string | null | undefined): Date | null {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

/** Formats a "YYYY-MM-DD" string as "Mon D, YYYY" - same calendar day on every device, regardless of viewer timezone. */
export function formatDateOnly(dateStr: string | null | undefined): string {
  const d = dateOnlyToLocalDate(dateStr);
  if (!d) return dateStr || "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The inverse of dateOnlyToLocalDate: a local-timezone Date back to "YYYY-MM-DD", never through toISOString (which renders in UTC and can land on the wrong calendar day). */
function toDateOnlyString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type LeaveCategory = "Earned Leave" | "Casual Leave";

export interface LeaveRequest {
  id?: string;
  userId: string;
  fullName: string;
  department: string;
  role?: string;
  leaveType: string;
  leaveCategory: LeaveCategory;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  appliedOn: string; // ISO timestamp
  countedInOpeningBalance: boolean;
}

function fromRow(row: any): LeaveRequest {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    department: row.department,
    role: row.role || undefined,
    leaveType: row.leave_type,
    leaveCategory: row.leave_category === "Casual Leave" ? "Casual Leave" : "Earned Leave",
    startDate: row.start_date,
    endDate: row.end_date,
    days: row.days,
    reason: row.reason,
    status: row.status,
    appliedOn: row.applied_on,
    countedInOpeningBalance: !!row.counted_in_opening_balance,
  };
}

export const applyLeave = async (
  userId: string,
  fullName: string,
  department: string,
  leaveType: string,
  leaveCategory: LeaveCategory,
  startDate: string,
  endDate: string,
  days: number,
  reason: string,
  role?: string
) => {
  const supabase = createClient();
  const insertData: any = {
    user_id: userId,
    full_name: fullName,
    department,
    leave_type: leaveType,
    leave_category: leaveCategory,
    start_date: startDate,
    end_date: endDate,
    days,
    reason,
    status: "Pending",
  };
  if (role) insertData.role = role;

  const { data, error } = await supabase.from("leave_requests").insert(insertData).select().single();
  if (error) throw error;
  return fromRow(data);
};

export const getUserLeaves = async (userId: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", userId)
    .order("applied_on", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
};

export const getAllPendingLeaves = async () => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("status", "Pending")
    .order("applied_on", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
};

export const updateLeaveStatus = async (leaveId: string, status: "Approved" | "Rejected") => {
  const supabase = createClient();

  // Fetch leave details
  const { data: leave } = await supabase.from("leave_requests").select("*").eq("id", leaveId).single();

  const { error } = await supabase.from("leave_requests").update({ status }).eq("id", leaveId);
  if (error) throw error;

  // Reflect an approval on the Attendance calendar (EL/CL only - a leave
  // request is never created with any other leave_type/category combo
  // through this path). Rejections never need to undo anything here,
  // because nothing is ever written to attendance until Approval.
  if (leave && status === "Approved") {
    try {
      await linkApprovedLeaveToAttendance(leave);
    } catch (e) {
      // A failure here must never block the leave approval itself, which
      // has already been committed above - just surface it for debugging.
      console.error("updateLeaveStatus: failed to sync attendance for approved leave", leaveId, e);
    }
  }

  if (leave) {
    try {
      const duration = `${formatDateOnly(leave.start_date)} - ${formatDateOnly(leave.end_date)}`;

      await fetch("/api/send-leave-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: leave.user_id,
          employeeName: leave.full_name,
          leaveType: leave.leave_type,
          duration: duration,
          days: leave.days,
          reason: leave.reason,
          status: status
        })
      });
    } catch (e) {
      console.error("Failed to trigger email", e);
    }
  }
};

function listenToQuery(
  filter: (query: any) => any,
  callback: (leaves: LeaveRequest[]) => void
) {
  const supabase = createClient();

  let currentData: LeaveRequest[] = [];

  const fetchAndEmit = async () => {
    const { data, error } = await filter(supabase.from("leave_requests").select("*")).order(
      "applied_on",
      { ascending: false }
    );
    if (error) {
      console.error("leave_requests listener error:", error);
      return;
    }
    currentData = (data || []).map(fromRow);
    callback(currentData);
  };

  fetchAndEmit();

  const channel = supabase
    .channel(`leave_requests_${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, async (payload) => {
      if (payload.eventType === "DELETE") {
        currentData = currentData.filter(l => l.id !== payload.old.id);
        callback(currentData);
        return;
      }

      // Targeted query for INSERT or UPDATE to ensure we only get it if it matches the query filter
      const { data, error } = await filter(
        supabase.from("leave_requests").select("*").eq("id", payload.new.id)
      );

      if (error) {
         console.error("Error fetching single leave:", error);
         return;
      }

      const updatedRow = data && data.length > 0 ? fromRow(data[0]) : null;

      if (updatedRow) {
         const index = currentData.findIndex(l => l.id === updatedRow.id);
         if (index !== -1) {
            currentData[index] = updatedRow;
         } else {
            currentData.unshift(updatedRow); // It's new or now matches filter, add to top since it's ordered by applied_on desc
         }
      } else {
         // It no longer matches the filter, remove it
         currentData = currentData.filter(l => l.id !== payload.new.id);
      }
      callback([...currentData]);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export const listenToUserLeaves = (userId: string, callback: (leaves: LeaveRequest[]) => void) => {
  return listenToQuery((q) => q.eq("user_id", userId), callback);
};

export const listenToPendingLeaves = (callback: (leaves: LeaveRequest[]) => void) => {
  return listenToQuery((q) => q.eq("status", "Pending"), callback);
};

export const listenToAllLeaves = (callback: (leaves: LeaveRequest[]) => void) => {
  return listenToQuery((q) => q, callback);
};

/**
 * Lightweight badge-count source for the Sidebar's pending-leave nav
 * badge. Uses a `head: true` count query instead of downloading the
 * entire leave_requests table — HRLeaveDashboard (which genuinely needs
 * every row to render its table) keeps using listenToAllLeaves() above,
 * unchanged. Status transitions can move a row INTO or OUT OF "Pending"
 * from any other status, so the realtime subscription can't be filtered
 * to status=eq.Pending (that would miss "Pending -> Approved" events,
 * which still need to decrement the count) — it has to watch the whole
 * table and just re-run the lightweight count query on any change.
 */
export const listenToPendingLeaveCount = (
  excludeUserId: string,
  callback: (count: number) => void
) => {
  const supabase = createClient();
  let timeoutId: ReturnType<typeof setTimeout>;

  const refresh = () => {
    supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "Pending")
      .neq("user_id", excludeUserId)
      .then(({ count, error }) => {
        if (error) {
          console.error("pending leave count error:", error);
          return;
        }
        callback(count ?? 0);
      });
  };

  refresh();

  const channel = supabase
    .channel(`pending_leave_count_${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(refresh, 300);
    })
    .subscribe();

  return () => {
    clearTimeout(timeoutId);
    supabase.removeChannel(channel);
  };
};

// Company-wide leave reset — everyone's automatic accrual counter starts
// from here at the earliest, regardless of how long they'd been employed
// before this date (that pre-reset entitlement, if any, is handled
// separately via a one-time "Manual Credit" leave_requests row per
// employee, not by this automatic counter).
const LEAVE_RESET_YEAR = 2026;
const LEAVE_RESET_MONTH = 7; // August (0-indexed in JS Dates)

// Single source of truth for "how many months of automatic accrual has this
// employee earned by this target month" — shared by the Leave Balance
// display (calculateAccruedLeaves below, evaluated as of "now") and
// Payroll's LOP calculation (lib/payroll.ts, evaluated as of the payroll
// month being generated). Both used to have their own separate, silently
// diverging copy of this — this one is the only copy now.
//
// Whichever is LATER of the employee's actual join date or the August 2026
// reset becomes the effective start; the first 2-day credit lands on the
// 1st of the month AFTER that start (matching "credited on the 1st of
// every month" — the start month itself earns nothing yet, same as how the
// August 2026 reset itself credits nothing until September 1st).
function monthsOfAutomaticAccrual(dateOfJoining: string | undefined, targetYear: number, targetMonth1Indexed: number): number {
  const resetStart = { year: LEAVE_RESET_YEAR, month: LEAVE_RESET_MONTH }; // 0-indexed month
  let startYear = resetStart.year;
  let startMonth = resetStart.month;

  if (dateOfJoining) {
    const joinDate = new Date(dateOfJoining);
    if (!isNaN(joinDate.getTime())) {
      const joinYear = joinDate.getFullYear();
      const joinMonth = joinDate.getMonth();
      const joinIsLater = joinYear > resetStart.year || (joinYear === resetStart.year && joinMonth > resetStart.month);
      if (joinIsLater) {
        startYear = joinYear;
        startMonth = joinMonth;
      }
    }
  }

  const totalMonths = (targetYear - startYear) * 12 + ((targetMonth1Indexed - 1) - startMonth);
  return Math.max(0, totalMonths);
}

// `inactiveSince` (profiles.inactive_since, stamped automatically by the
// stamp_inactive_since_trigger when status flips to 'Inactive' - migration
// 38) caps accrual at the moment the employee actually left, instead of
// always accruing up through "now" for someone no longer working. Reactivation
// clears inactive_since, so this only ever shortens the "now" used below.
export const calculateMonthsEmployed = (dateOfJoining: string | undefined, inactiveSince?: string | null): number => {
  // Force the date to IST (Indian Standard Time) so it resets universally for everyone at exactly 12:00 AM IST
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
};

/**
 * Same accrual rule as calculateMonthsEmployed, but for a specific target
 * month/year (e.g. the month Payroll is being generated for) instead of
 * "now". Used by lib/payroll.ts so Payroll and the Leave Balance display
 * can never silently disagree again.
 */
export const calculateAutomaticAccrualForMonth = (dateOfJoining: string | undefined, year: number, month1Indexed: number): number => {
  return monthsOfAutomaticAccrual(dateOfJoining, year, month1Indexed) * 2;
};

// Kept ONLY for scripts/seed-el-cl-opening-balances.js's one-time use: it
// needs the pre-split single-pool total (exactly as this always worked) to
// compute each employee's opening Earned/Casual split. No ongoing UI calls
// this anymore — see calculateElClBalances() below for the real, current
// math.
export const calculateAccruedLeaves = (dateOfJoining: string | undefined, leaves: LeaveRequest[] = [], inactiveSince?: string | null): number => {
  const months = calculateMonthsEmployed(dateOfJoining, inactiveSince);
  const automaticLeaves = months * 2;
  const manualLeaves = leaves.filter(l => (l.leaveType === "Manual Credit" || l.leaveType === "Manual Deduction") && l.status === "Approved").reduce((s, l) => s + l.days, 0);
  return automaticLeaves + manualLeaves;
};

// ============================================================================
// Earned Leave (EL) / Casual Leave (CL) split
// ============================================================================
// The single pool above is being replaced by two independently-tracked
// categories, each accruing 1 day/month (half of the original 2/month —
// the total credited per month is unchanged, only how it's bucketed):
//
//   Earned Leave  — lifetime-cumulative, never expires, carries forward
//                   forever. Counted from whichever is later of the
//                   employee's join date or EL_CL_SPLIT below, PLUS a
//                   fixed one-time opening balance (profiles.el_opening_
//                   balance) that captures everything accrued/used before
//                   the split — never a Manual Credit row, see migration 51.
//   Casual Leave  — resets every financial year (1 April – 31 March).
//                   Counted from whichever is later of the employee's join
//                   date, the start of the CURRENT financial year, or
//                   EL_CL_SPLIT. Its one-time opening balance (profiles.
//                   cl_opening_balance) only ever applies while evaluating
//                   a date still within the SAME financial year the split
//                   happened in — the moment "now" crosses into a later
//                   financial year, that opening amount simply stops being
//                   added (nothing is ever written to make this happen;
//                   it's a date-range check recomputed fresh every call).
//
// EL_CL_SPLIT is the day this feature went live.
const EL_CL_SPLIT_YEAR = 2026;
const EL_CL_SPLIT_MONTH = 10; // November (0-indexed)

interface MonthAnchor { year: number; month: number } // month is 0-indexed

function laterAnchor(a: MonthAnchor, b: MonthAnchor): MonthAnchor {
  return a.year > b.year || (a.year === b.year && a.month > b.month) ? a : b;
}

// Same "whichever is later: baseline or join date" rule as
// monthsOfAutomaticAccrual above, generalized to take any baseline — kept
// as a separate function (rather than changing that one) so the still-used
// pre-split formula it backs is never at risk of an accidental regression.
function monthsSinceAnchor(dateOfJoining: string | undefined, baseline: MonthAnchor, targetYear: number, targetMonth1Indexed: number): number {
  let start = baseline;
  if (dateOfJoining) {
    const joinDate = new Date(dateOfJoining);
    if (!isNaN(joinDate.getTime())) {
      start = laterAnchor(baseline, { year: joinDate.getFullYear(), month: joinDate.getMonth() });
    }
  }
  const totalMonths = (targetYear - start.year) * 12 + ((targetMonth1Indexed - 1) - start.month);
  return Math.max(0, totalMonths);
}

/** 1 April of the financial year containing `date` (FY runs Apr 1 – Mar 31). */
function financialYearStart(date: Date): MonthAnchor {
  return { year: date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1, month: 3 };
}

export interface LeaveCategoryBalance {
  accrued: number;
  used: number;
  pending: number;
  available: number;
}

export interface ElClBalances {
  earned: LeaveCategoryBalance;
  casual: LeaveCategoryBalance;
}

export interface ElClWindow {
  elMonths: number;
  clMonths: number;
  elWindowStart: Date; // leave rows before this date never count toward EL (already captured by the opening balance)
  clWindowStart: Date; // leave rows before this date never count toward CL (prior FY, or the opening balance's FY, whichever is later)
  clOpeningBalanceApplies: boolean; // false once "now" has moved into a financial year after the split's own FY
}

/**
 * The EL/CL accrual-months, window-start dates, and whether the CL opening
 * balance is still "live" for a specific target month/year (not necessarily
 * "now") — shared by calculateElClBalances below (called with today's date)
 * and lib/payroll.ts's calculateEmployeeLopAndLeaves (called with the
 * payroll month being generated), so the two can never silently disagree.
 */
export function getElClWindow(dateOfJoining: string | undefined, targetYear: number, targetMonth1Indexed: number): ElClWindow {
  const splitAnchor: MonthAnchor = { year: EL_CL_SPLIT_YEAR, month: EL_CL_SPLIT_MONTH };
  const asOfForFy = new Date(targetYear, targetMonth1Indexed - 1, 1);
  const currentFyStart = financialYearStart(asOfForFy);
  const splitFyStart = financialYearStart(new Date(splitAnchor.year, splitAnchor.month, 1));
  const clAnchor = laterAnchor(splitAnchor, currentFyStart);

  return {
    elMonths: monthsSinceAnchor(dateOfJoining, splitAnchor, targetYear, targetMonth1Indexed),
    clMonths: monthsSinceAnchor(dateOfJoining, clAnchor, targetYear, targetMonth1Indexed),
    elWindowStart: new Date(splitAnchor.year, splitAnchor.month, 1),
    clWindowStart: new Date(clAnchor.year, clAnchor.month, 1),
    clOpeningBalanceApplies: currentFyStart.year === splitFyStart.year && currentFyStart.month === splitFyStart.month,
  };
}

/**
 * Splits a single leave total into Earned/Casual per the required rule:
 * EL = ceiling(total / 2), CL = total - EL. Earned always gets the
 * greater-or-equal share. Used ONLY by the one-time opening-balance
 * script — never by any ongoing accrual/application logic.
 */
export function splitElClOpeningBalance(total: number): { el: number; cl: number } {
  const el = Math.ceil(total / 2);
  const cl = total - el;
  return { el, cl };
}

/**
 * Current Earned Leave and Casual Leave balances, derived from `leaves`
 * (that employee's full leave_requests rows dated on/after the EL/CL
 * split, any status/category — this function does its own filtering),
 * today's date, and the two one-time opening-balance numbers stored on
 * their profile row. Nothing here is persisted; calling this again
 * tomorrow — or the moment a new financial year begins — simply produces
 * a different, correct answer on its own, including the CL opening
 * balance silently dropping out once its financial year has ended.
 */
export function calculateElClBalances(
  dateOfJoining: string | undefined,
  leaves: LeaveRequest[] = [],
  inactiveSince: string | null | undefined,
  elOpeningBalance: number | null | undefined,
  clOpeningBalance: number | null | undefined,
  asOf?: Date
): ElClBalances {
  let effective = asOf || new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (inactiveSince) {
    const inactiveRaw = new Date(inactiveSince);
    if (!isNaN(inactiveRaw.getTime())) {
      const inactiveIST = new Date(inactiveRaw.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      if (inactiveIST < effective) effective = inactiveIST;
    }
  }
  const targetYear = effective.getFullYear();
  const targetMonth1Indexed = effective.getMonth() + 1;

  const { elMonths, clMonths, elWindowStart, clWindowStart, clOpeningBalanceApplies } = getElClWindow(dateOfJoining, targetYear, targetMonth1Indexed);

  const inWindow = (dateStr: string, windowStart: Date) => {
    const d = dateOnlyToLocalDate(dateStr);
    return !!d && d >= windowStart;
  };

  // `windowed` is true only for Casual Leave, whose usage must reset every
  // financial year - Earned Leave is lifetime, so a leave's own date never
  // excludes it there. In BOTH cases, any row flagged
  // countedInOpeningBalance was already summed into the one-time opening
  // snapshot (lib: calculateAccruedLeaves, which has no date filter at all
  // - it can net out a leave dated in the future just as easily as one in
  // the past) and must never be summed again here, or it gets deducted
  // twice. Pending rows are never flagged (only Approved rows are ever
  // summed into the opening snapshot), so they always count in full,
  // regardless of when they were applied.
  const forCategory = (category: LeaveCategory, opening: number, months: number, windowStart: Date, windowed: boolean): LeaveCategoryBalance => {
    const categoryLeaves = leaves.filter((l) => l.leaveCategory === category && (!windowed || inWindow(l.startDate, windowStart)));

    const manualAdjustmentDays = categoryLeaves
      .filter((l) => l.status === "Approved" && !l.countedInOpeningBalance && (l.leaveType === "Manual Credit" || l.leaveType === "Manual Deduction"))
      .reduce((sum, l) => sum + l.days, 0);
    const used = categoryLeaves
      .filter((l) => l.status === "Approved" && !l.countedInOpeningBalance && l.leaveType !== "Manual Credit" && l.leaveType !== "Manual Deduction")
      .reduce((sum, l) => sum + l.days, 0);
    const pending = categoryLeaves
      .filter((l) => l.status === "Pending" && l.leaveType !== "Manual Credit" && l.leaveType !== "Manual Deduction")
      .reduce((sum, l) => sum + l.days, 0);

    const accrued = opening + months * 1 + manualAdjustmentDays;
    return { accrued, used, pending, available: Math.max(0, accrued - used - pending) };
  };

  return {
    earned: forCategory("Earned Leave", elOpeningBalance || 0, elMonths, elWindowStart, false),
    casual: forCategory("Casual Leave", clOpeningBalanceApplies ? (clOpeningBalance || 0) : 0, clMonths, clWindowStart, true),
  };
}

// ============================================================================
// Attendance <-> Leave (EL/CL) integration
// ============================================================================
// Three things live here:
//  1. The day-by-day leave-map + Sandwich Rule + balance-exhaustion math,
//     moved here from lib/payroll.ts so it has exactly one implementation -
//     Payroll's monthly LOP total and Attendance's per-day Paid/LOP badge
//     now both call the same function and can never silently disagree
//     (the project has already been bitten once this session by two
//     independent copies of near-identical leave math drifting apart).
//  2. getDailyLeavePaymentStatus() - the per-day read that Attendance needs
//     but Payroll never did (Payroll only ever needed the monthly total).
//  3. createAttendanceLinkedLeave() + the attendance-sync half of
//     updateLeaveStatus() above - the two directions that keep an
//     attendance day and its backing leave request pointed at each other
//     via attendance.leave_request_id, so neither side can double-count.

/**
 * Builds one category's day-by-day leave map (+ Sandwich Rule): which
 * calendar days does this employee's APPROVED, non-manual, non-opening-
 * balance leave in this category cover, and how much of that day (1 or 0.5)
 * does it count for. `windowed` restricts to days on/after `windowStart` -
 * used only for Casual Leave's financial-year reset; Earned Leave is
 * lifetime. Any row flagged countedInOpeningBalance is excluded here (it
 * was already folded into the one-time opening snapshot), exactly as in
 * calculateElClBalances above.
 */
export function computeCategoryLeaveMap(
  leaves: LeaveRequest[],
  category: LeaveCategory,
  windowStart: Date,
  windowed: boolean
): Map<string, number> {
  const categoryLeaves = leaves.filter((l) => {
    if (l.leaveCategory !== category || l.status !== "Approved") return false;
    if (l.countedInOpeningBalance) return false;
    if (l.leaveType === "Manual Credit" || l.leaveType === "Manual Deduction") return false;
    if (!windowed) return true;
    const start = dateOnlyToLocalDate(l.startDate);
    return !!start && start >= windowStart;
  });

  const leaveMap = new Map<string, number>();
  categoryLeaves.forEach((l) => {
    const start = dateOnlyToLocalDate(l.startDate);
    const end = dateOnlyToLocalDate(l.endDate);
    if (!start || !end) return;
    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = toDateOnlyString(curr);
      const currentVal = leaveMap.get(dateStr) || 0;
      const dayVal = l.days === 0.5 && start.getTime() === end.getTime() ? 0.5 : 1;
      leaveMap.set(dateStr, Math.min(1, currentVal + dayVal));
      curr.setDate(curr.getDate() + 1);
    }
  });

  // Sandwich Rule: approved leave on a Friday AND the following Monday ->
  // the Saturday/Sunday in between count as leave too.
  const dates = Array.from(leaveMap.keys()).sort();
  dates.forEach((dateStr) => {
    const d = dateOnlyToLocalDate(dateStr);
    if (!d) return;
    if (d.getDay() === 5) {
      const nextMonday = new Date(d);
      nextMonday.setDate(d.getDate() + 3);
      const mondayStr = toDateOnlyString(nextMonday);
      if (leaveMap.has(mondayStr)) {
        const sat = new Date(d);
        sat.setDate(d.getDate() + 1);
        const sun = new Date(d);
        sun.setDate(d.getDate() + 2);
        leaveMap.set(toDateOnlyString(sat), 1);
        leaveMap.set(toDateOnlyString(sun), 1);
      }
    }
  });

  return leaveMap;
}

/** Splits one category's leave map into "taken before this month" / "taken in this month". */
export function splitLeaveMapByMonth(
  leaveMap: Map<string, number>,
  month: number,
  year: number
): { takenBeforeMonth: number; takenInMonth: number } {
  let takenBeforeMonth = 0;
  let takenInMonth = 0;
  leaveMap.forEach((val, dateStr) => {
    const d = dateOnlyToLocalDate(dateStr);
    if (!d) return;
    if (d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() + 1 < month)) {
      takenBeforeMonth += val;
    } else if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      takenInMonth += val;
    }
  });
  return { takenBeforeMonth, takenInMonth };
}

export interface CategoryMonthUsage {
  takenInMonth: number;
  availableBalanceAtStartOfMonth: number;
  unpaidLeaves: number;
  leaveMap: Map<string, number>;
}

/**
 * One category's Paid/LOP math for one specific month - the single
 * implementation shared by lib/payroll.ts's calculateEmployeeLopAndLeaves
 * (which needs the monthly totals) and getDailyLeavePaymentStatus below
 * (which needs the same totals to decide one specific day).
 */
export function computeCategoryMonthUsage(
  leaves: LeaveRequest[],
  category: LeaveCategory,
  opening: number,
  months: number,
  windowStart: Date,
  windowed: boolean,
  month: number,
  year: number
): CategoryMonthUsage {
  const leaveMap = computeCategoryLeaveMap(leaves, category, windowStart, windowed);
  const { takenBeforeMonth, takenInMonth } = splitLeaveMapByMonth(leaveMap, month, year);

  const manualAdjustmentDays = leaves
    .filter((l) => {
      if (l.status !== "Approved" || l.leaveCategory !== category || l.countedInOpeningBalance) return false;
      if (l.leaveType !== "Manual Credit" && l.leaveType !== "Manual Deduction") return false;
      const start = dateOnlyToLocalDate(l.startDate);
      if (!start) return false;
      if (windowed && start < windowStart) return false;
      return start.getFullYear() < year || (start.getFullYear() === year && start.getMonth() + 1 <= month);
    })
    .reduce((sum, l) => sum + l.days, 0);

  const totalAccruedUpToMonth = opening + months * 1 + manualAdjustmentDays;
  const availableBalanceAtStartOfMonth = Math.max(0, totalAccruedUpToMonth - takenBeforeMonth);
  const unpaidLeaves = Math.max(0, takenInMonth - availableBalanceAtStartOfMonth);

  return { takenInMonth, availableBalanceAtStartOfMonth, unpaidLeaves, leaveMap };
}

/**
 * Display-only: was this SPECIFIC day Paid or LOP? Walks that month's days
 * for the category in chronological order and marks a day LOP once the
 * running total exceeds that month's opening balance. By construction, the
 * days this marks "LOP" always sum to exactly computeCategoryMonthUsage's
 * unpaidLeaves for that month - so an Attendance badge can never show a
 * number Payroll disagrees with. The one approximation: if a single day's
 * own value straddles the exact balance boundary (only possible for a
 * half-day entry), it's shown whole as either Paid or LOP rather than
 * split - the authoritative money figure is always the aggregate
 * unpaidLeaves total, never this per-day label.
 */
export function getDailyLeavePaymentStatus(
  dateOfJoining: string | undefined,
  leaves: LeaveRequest[],
  elOpeningBalance: number | null | undefined,
  clOpeningBalance: number | null | undefined,
  category: LeaveCategory,
  dateStr: string
): "Paid" | "LOP" {
  const parsed = dateOnlyToLocalDate(dateStr);
  if (!parsed) return "Paid";
  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;

  const { elMonths, clMonths, elWindowStart, clWindowStart, clOpeningBalanceApplies } = getElClWindow(dateOfJoining, year, month);
  const isEl = category === "Earned Leave";
  const opening = isEl ? elOpeningBalance || 0 : clOpeningBalanceApplies ? clOpeningBalance || 0 : 0;
  const months = isEl ? elMonths : clMonths;
  const windowStart = isEl ? elWindowStart : clWindowStart;
  const windowed = !isEl;

  const usage = computeCategoryMonthUsage(leaves, category, opening, months, windowStart, windowed, month, year);

  const datesInMonth = Array.from(usage.leaveMap.keys())
    .filter((d) => {
      const dd = dateOnlyToLocalDate(d);
      return !!dd && dd.getFullYear() === year && dd.getMonth() + 1 === month;
    })
    .sort();

  let cumulative = 0;
  for (const d of datesInMonth) {
    cumulative += usage.leaveMap.get(d) || 0;
    if (d === dateStr) {
      return cumulative > usage.availableBalanceAtStartOfMonth ? "LOP" : "Paid";
    }
  }
  return "Paid";
}

/**
 * Creates the single-day, Approved leave_requests row that backs an
 * HR-assigned EL/CL attendance entry when no real application already
 * covers that date. The caller (HRAttendanceDashboard's handleStatusChange)
 * is responsible for only calling this when attendance.leave_request_id is
 * still null for that day - once set, every later edit just reads it
 * instead, so this only ever runs once per day.
 *
 * `created_via_attendance: true` is the strict ownership flag the revert
 * path checks before auto-rejecting a row - never inferred from the
 * reason text alone.
 *
 * Race-condition handling: migration 52 adds a database-level unique
 * index on (user_id, start_date) where created_via_attendance = true, so
 * if two HR users submit for the same employee/day at the same instant,
 * the loser's insert fails with a Postgres unique-violation (23505)
 * instead of creating a duplicate row. On that specific error, this
 * re-fetches and returns the winner's row instead of throwing - the
 * caller ends up linked to whichever request actually won, and the UI
 * reflects the category that was actually recorded even if it differs
 * from what this particular caller tried to set.
 */
export const createAttendanceLinkedLeave = async (
  userId: string,
  fullName: string,
  category: LeaveCategory,
  dateStr: string,
  isHalfDay: boolean,
  role?: string,
  department?: string
): Promise<LeaveRequest> => {
  const supabase = createClient();
  const insertData: any = {
    user_id: userId,
    full_name: fullName,
    leave_type: "Leave",
    leave_category: category,
    start_date: dateStr,
    end_date: dateStr,
    days: isHalfDay ? 0.5 : 1,
    reason: "Marked via Attendance by HR/Admin",
    status: "Approved",
    created_via_attendance: true,
  };
  if (role) insertData.role = role;
  if (department) insertData.department = department;

  const { data, error } = await supabase.from("leave_requests").insert(insertData).select().single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: fetchErr } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", userId)
        .eq("start_date", dateStr)
        .eq("created_via_attendance", true)
        .single();
      if (fetchErr) throw fetchErr;
      return fromRow(existing);
    }
    throw error;
  }
  return fromRow(data);
};

/** Today's calendar date in IST, at midnight - the floor below which this sync never writes. Same IST-pinning convention as calculateMonthsEmployed above. */
function todayIST(): Date {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * On approval only, writes the leave's category onto every attendance day
 * it covers and links that day back to this leave via leave_request_id -
 * so the Attendance calendar shows WHY the employee wasn't at work, and so
 * HR editing that day later knows a real application already explains it.
 *
 * Deliberately conservative in two ways:
 *   - Never touches a day before today (IST). A leave approved for a past
 *     date (e.g. a backfilled application) is reflected in the employee's
 *     EL/CL balance as normal, but the Attendance calendar for that day is
 *     left completely alone - "preserve all existing/historical attendance
 *     data" wins over auto-reflecting every approval, by explicit decision.
 *     If HR wants a specific past day to visibly show EL/CL, that's the
 *     Attendance screen's own manual EL/CL dropdown option, a deliberate
 *     per-day action, not this automatic side-effect of an approval.
 *   - For today/future days, a day already carrying real check-in/
 *     check-out timestamps, or already linked to a DIFFERENT leave
 *     request, is left completely untouched - this must never overwrite
 *     genuine attendance data or an existing link.
 */
async function linkApprovedLeaveToAttendance(leave: any): Promise<void> {
  const supabase = createClient();
  const start = dateOnlyToLocalDate(leave.start_date);
  const end = dateOnlyToLocalDate(leave.end_date);
  if (!start || !end) return;

  const floor = todayIST();
  if (end < floor) return; // the entire request is in the past - skip attendance sync entirely

  const category: LeaveCategory = leave.leave_category === "Casual Leave" ? "Casual Leave" : "Earned Leave";

  const { data: existingRows, error: fetchErr } = await supabase
    .from("attendance")
    .select("id, date, check_in_time, check_out_time, leave_request_id")
    .eq("user_id", leave.user_id)
    .gte("date", leave.start_date)
    .lte("date", leave.end_date);
  if (fetchErr) throw fetchErr;

  const byDate = new Map<string, any>((existingRows || []).map((r: any) => [r.date, r]));
  const isSingleHalfDay = leave.days === 0.5 && leave.start_date === leave.end_date;

  const curr = new Date(start);
  while (curr <= end) {
    if (curr < floor) {
      curr.setDate(curr.getDate() + 1);
      continue; // this specific day of a multi-day request is in the past - skip just this day
    }

    const dateStr = toDateOnlyString(curr);
    const existing = byDate.get(dateStr);

    if (existing) {
      const hasRealClock = !!existing.check_in_time || !!existing.check_out_time;
      const linkedToOther = !!existing.leave_request_id && existing.leave_request_id !== leave.id;
      if (!hasRealClock && !linkedToOther) {
        const { error } = await supabase
          .from("attendance")
          .update({ status: category, leave_request_id: leave.id, is_edited: true })
          .eq("id", existing.id);
        if (error) throw error;
      }
    } else {
      const { error } = await supabase.from("attendance").insert({
        user_id: leave.user_id,
        full_name: leave.full_name,
        role: leave.role || "Employee",
        date: dateStr,
        status: category,
        is_half_day: isSingleHalfDay,
        is_late: false,
        is_edited: true,
        working_seconds: 0,
        leave_request_id: leave.id,
      });
      if (error) throw error;
    }

    curr.setDate(curr.getDate() + 1);
  }
}
