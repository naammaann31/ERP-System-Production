import { createClient } from "@/lib/supabase/client";

export interface AttendanceRecord {
  id?: string;
  userId: string;
  fullName: string;
  role?: string;
  date: string; // YYYY-MM-DD
  checkInTime: string | null; // ISO timestamp
  checkOutTime: string | null; // ISO timestamp
  status: "Present" | "Checked In" | "Absent" | "On Leave" | "Week Off";
  workingSeconds: number;
}

function fromRow(row: any): AttendanceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    role: row.role || undefined,
    date: row.date,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    status: row.status,
    workingSeconds: row.working_seconds,
  };
}

export const getLocalDateString = () => {
  const now = new Date();

  // The shift starts at 7:30 PM (19:30).
  // Any time before 7:30 PM belongs to the previous calendar day's shift.
  // This ensures the shift resets exactly at 7:30 PM every day.
  if (now.getHours() < 19 || (now.getHours() === 19 && now.getMinutes() < 30)) {
    now.setDate(now.getDate() - 1);
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const checkIn = async (userId: string, fullName: string, role?: string) => {
  const supabase = createClient();
  const dateStr = getLocalDateString();

  const { data: existing } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .maybeSingle();

  if (existing) return fromRow(existing);

  const insertData: any = {
    user_id: userId,
    full_name: fullName,
    date: dateStr,
    check_in_time: new Date().toISOString(),
    check_out_time: null,
    status: "Checked In",
    working_seconds: 0,
  };
  if (role) insertData.role = role;

  const { data, error } = await supabase.from("attendance").insert(insertData).select().single();

  if (error) {
    // Unique violation (raced with another check-in): fetch what won.
    const { data: raced } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .maybeSingle();
    if (raced) return fromRow(raced);
    throw error;
  }

  return fromRow(data);
};

export const updateWorkingSeconds = async (docId: string, workingSeconds: number) => {
  const supabase = createClient();
  await supabase.from("attendance").update({ working_seconds: workingSeconds }).eq("id", docId);
};

export const checkOut = async (docId: string, workingSeconds: number) => {
  const supabase = createClient();
  await supabase
    .from("attendance")
    .update({
      check_out_time: new Date().toISOString(),
      status: "Present",
      working_seconds: workingSeconds,
    })
    .eq("id", docId);
};

export const getTodayAttendance = async (userId: string) => {
  const supabase = createClient();
  const dateStr = getLocalDateString();
  const { data } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .maybeSingle();

  return data ? fromRow(data) : null;
};

export const getAllTodayAttendance = async () => {
  const supabase = createClient();
  const dateStr = getLocalDateString();
  const { data, error } = await supabase.from("attendance").select("*").eq("date", dateStr);
  if (error) throw error;
  return (data || []).map(fromRow);
};

export const getAttendanceByDate = async (dateStr: string) => {
  const supabase = createClient();
  const { data, error } = await supabase.from("attendance").select("*").eq("date", dateStr);
  if (error) throw error;
  return (data || []).map(fromRow);
};

export const getUserAttendanceForMonth = async (userId: string, yearMonth: string) => {
  const supabase = createClient();
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-31`;

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []).map(fromRow);
};
