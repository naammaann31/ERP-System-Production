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
  if (!dateOfJoining) return 1; // Default to 1 month if no date is set
  
  // Extract date part in case it includes time, then split by '-'
  const parts = dateOfJoining.split('T')[0].split('-');
  if (parts.length < 3) return 1;

  const joinYear = parseInt(parts[0], 10);
  const joinMonth = parseInt(parts[1], 10) - 1; // 0-indexed month

  const now = new Date();
  
  const yearsDiff = now.getFullYear() - joinYear;
  const monthsDiff = now.getMonth() - joinMonth;
  const totalMonths = (yearsDiff * 12) + monthsDiff;
  
  // They get 2 leaves for the current month they are in as well, so we add 1.
  return Math.max(1, totalMonths + 1);
};

export const calculateAccruedLeaves = (dateOfJoining: string | undefined): number => {
  const months = calculateMonthsEmployed(dateOfJoining);
  return months * 2;
};
