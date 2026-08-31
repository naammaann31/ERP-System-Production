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

  const fetchAndEmit = async () => {
    const { data, error } = await filter(supabase.from("leave_requests").select("*")).order(
      "applied_on",
      { ascending: false }
    );
    if (error) {
      console.error("leave_requests listener error:", error);
      return;
    }
    callback((data || []).map(fromRow));
  };

  fetchAndEmit();

  const channel = supabase
    .channel(`leave_requests_${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, fetchAndEmit)
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

export const calculateMonthsEmployed = (dateOfJoining: string | undefined): number => {
  // We want to start crediting 2 leaves on the 1st of every month, starting Sept 1st, 2026.
  // Since leaves were reset to 0 in August 2026, our baseline is August 2026.
  const resetYear = 2026;
  const resetMonth = 7; // August (0-indexed in JS Dates)
  
  // Force the date to IST (Indian Standard Time) so it resets universally for everyone at exactly 12:00 AM IST
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  
  const yearsDiff = now.getFullYear() - resetYear;
  const monthsDiff = now.getMonth() - resetMonth;
  const totalMonths = (yearsDiff * 12) + monthsDiff;
  
  // Return the number of months passed since August 2026. 
  // e.g., On Sept 1st, this becomes 1. 1 * 2 = 2 leaves credited.
  return Math.max(0, totalMonths);
};

export const calculateAccruedLeaves = (dateOfJoining: string | undefined, leaves: LeaveRequest[] = []): number => {
  const months = calculateMonthsEmployed(dateOfJoining);
  const automaticLeaves = months * 2;
  const manualLeaves = leaves.filter(l => (l.leaveType === "Manual Credit" || l.leaveType === "Manual Deduction") && l.status === "Approved").reduce((s, l) => s + l.days, 0);
  return automaticLeaves + manualLeaves;
};
