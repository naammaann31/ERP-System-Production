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
  const { error } = await supabase.from("leave_requests").update({ status }).eq("id", leaveId);
  if (error) throw error;
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
