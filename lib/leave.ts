import { createClient } from "@/lib/supabase/client";

export interface LeaveRequest {
  id?: string;
  userId: string;
  fullName: string;
  department: string;
  role?: string;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  appliedOn: string; // ISO timestamp
}

function fromRow(row: any): LeaveRequest {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    department: row.department,
    role: row.role || undefined,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    days: row.days,
    reason: row.reason,
    status: row.status,
    appliedOn: row.applied_on,
  };
}

export const applyLeave = async (
  userId: string,
  fullName: string,
  department: string,
  leaveType: string,
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
  
  if (leave) {
    try {
      const formatDate = (dateStr: string) => {
          if (!dateStr) return "-";
          const d = new Date(dateStr);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };
      const duration = `${formatDate(leave.start_date)} - ${formatDate(leave.end_date)}`;
      
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

export const calculateMonthsEmployed = (dateOfJoining: string | undefined): number => {
  // Force the date to IST (Indian Standard Time) so it resets universally for everyone at exactly 12:00 AM IST
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return monthsOfAutomaticAccrual(dateOfJoining, now.getFullYear(), now.getMonth() + 1);
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

export const calculateAccruedLeaves = (dateOfJoining: string | undefined, leaves: LeaveRequest[] = []): number => {
  const months = calculateMonthsEmployed(dateOfJoining);
  const automaticLeaves = months * 2;
  const manualLeaves = leaves.filter(l => (l.leaveType === "Manual Credit" || l.leaveType === "Manual Deduction") && l.status === "Approved").reduce((s, l) => s + l.days, 0);
  return automaticLeaves + manualLeaves;
};
