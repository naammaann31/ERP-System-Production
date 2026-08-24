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
  isLate?: boolean;
  isHalfDay?: boolean;
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
    isLate: row.is_late,
    isHalfDay: row.is_half_day,
  };
}

/**
 * Attendance is recorded in Indian time for everyone, always.
 *
 * Deriving it from the device clock would mean a laptop set to another
 * timezone â€” or simply set wrong â€” records a different day and time from
 * everyone else. Pinning the zone here makes a clock-in mean the same thing
 * no matter whose machine it came from.
 */
export const IST_TIME_ZONE = "Asia/Kolkata";
const IST_UTC_OFFSET = "+05:30"; // India has no daylight saving, so this is fixed.

/**
 * Renders an instant as an Indian clock time, whatever the device is set to.
 *
 * Used for the live clock on the attendance card: `toLocaleTimeString` without
 * an explicit zone follows the device, so a laptop on another timezone showed
 * 07:08 PM while India was on 04:39 AM.
 */
export const formatISTClock = (date: Date | null | undefined): string => {
  if (!date || Number.isNaN(date.getTime())) return "--:-- --";
  return date.toLocaleTimeString("en-US", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/** Calendar/clock parts of an instant as seen in India. */
export const istParts = (d: Date): Record<string, string> => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    // h23 rather than hour12:false â€” the latter renders midnight as "24"
    // in some engines, which would roll the date forward by a day.
    hourCycle: "h23",
  }).formatToParts(d);

  const out: Record<string, string> = {};
  for (const { type, value } of parts) out[type] = value;
  
  // Apple/WebKit bug workaround: Some browsers ignore hourCycle/hour12 and return 12-hour format anyway.
  if (out.dayPeriod) {
    let h = parseInt(out.hour, 10);
    const isPM = out.dayPeriod.toLowerCase().includes("pm") || out.dayPeriod.toLowerCase().includes("p.m.");
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    out.hour = h.toString().padStart(2, "0");
  }
  
  return out;
};

/**
 * Formats an instant as an IST wall-clock string â€” "YYYY-MM-DDTHH:mm:ss.sss",
 * deliberately carrying no timezone designator.
 *
 * `check_in_time` / `check_out_time` are `timestamp` WITHOUT time zone, and
 * this app stores IST wall-clock in them rather than UTC, so the value read
 * straight out of the database matches the clock of the person who clocked in.
 * `toISOString()` must NOT be used here: it converts to UTC, which is what
 * previously made a 04:13 check-in land in the row as 22:43 the day before.
 */
const toLocalTimestamp = (d: Date): string => {
  const p = istParts(d);
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${ms}`;
};

/**
 * Parses a timestamp read back from the `attendance` table.
 *
 * Values are written by toLocalTimestamp above, i.e. local wall-clock with no
 * timezone designator â€” and per the ECMAScript spec a date-time string with no
 * designator is parsed as local time, so the round trip is exact.
 *
 * A value that DOES carry a zone is honoured as written. That covers rows
 * created before the switch to wall-clock storage (they were UTC, tagged or
 * not â€” see migration 15, which shifted the untagged ones) and anything a
 * `timestamptz` column would return.
 */
export const parseTimestamp = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Stored values are IST wall-clock with no designator, so IST is attached
  // explicitly rather than letting Date assume the viewer's own timezone â€”
  // otherwise HR opening the dashboard from a different zone would read every
  // check-in shifted. A value that already carries a zone is honoured as
  // written. Postgres hands back "YYYY-MM-DD HH:mm:ss"; the T form is what
  // Date parses consistently across browsers.
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  const d = new Date(hasZone ? s : `${s.replace(" ", "T")}${IST_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Renders a stored attendance timestamp in Indian time, for every viewer. */
export const formatAttendanceTime = (value: string | null | undefined): string => {
  const d = parseTimestamp(value);
  if (!d) return "-";
  return d.toLocaleTimeString("en-US", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Seconds worked, always DERIVED from the stored timestamps rather than
 * accumulated by a ticking counter.
 *
 * A counter that does `seconds + 1` on an interval drifts whenever the tab is
 * backgrounded (browsers throttle timers to once a minute), and double-counts
 * if the tick ever runs twice â€” which it did, so the clock advanced two
 * seconds per second. Recomputing from check-in is idempotent: it cannot
 * drift or double-count no matter how often, or how erratically, it runs.
 */
export const computeWorkedSeconds = (
  record: Pick<AttendanceRecord, "checkInTime" | "checkOutTime" | "workingSeconds">,
  nowMs: number = Date.now()
): number => {
  const start = parseTimestamp(record.checkInTime);
  if (!start) return record.workingSeconds || 0;
  const end = parseTimestamp(record.checkOutTime);
  const endMs = end ? end.getTime() : nowMs;
  return Math.max(0, Math.floor((endMs - start.getTime()) / 1000));
};

export const getLocalDateString = () => {
  const now = new Date();
  const p = istParts(now);
  
  // Shift Window Logic: 
  // If the employee clocks in between midnight (12:00 AM) and 6:00 AM, 
  // it logically belongs to the previous business day's night shift.
  if (Number(p.hour) < 6) {
    // Subtract 6 hours to safely roll the calendar date back by 1 day
    const yesterday = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const yp = istParts(yesterday);
    return `${yp.year}-${yp.month}-${yp.day}`;
  }
  
  return `${p.year}-${p.month}-${p.day}`;
};

/** The current month in India, as YYYY-MM. */
export const getISTYearMonth = () => {
  const p = istParts(new Date());
  return `${p.year}-${p.month}`;
};

/**
 * The last `count` months ending with the current Indian month, newest first,
 * as { value: "2026-08", label: "August 2026" }.
 *
 * Generated rather than listed literally: the month picker used to be a
 * hardcoded Mayâ€“Sep 2026 array defaulting to "July 2026", so it opened on a
 * month with no records and stopped working entirely outside that window.
 */
export const getRecentMonthOptions = (count = 12): { value: string; label: string }[] => {
  const p = istParts(new Date());
  const year = Number(p.year);
  const month = Number(p.month);

  return Array.from({ length: count }, (_, i) => {
    // Built in UTC purely as calendar arithmetic â€” Date handles the year
    // rollover, and reading back UTC parts keeps the device zone out of it.
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });
    return { value, label };
  });
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

  const now = new Date();
  const p = istParts(now);
  const hour = Number(p.hour);
  const minute = Number(p.minute);

  // Late Comer Logic: Clock in after 7:45 PM or between 12:00 AM and 6:00 AM
  let isLate = false;
  let isAbsent = false;

  if (hour > 19 || (hour === 19 && minute > 45) || hour < 6) {
    isLate = true;
  }
  
  // Absent Logic: If user clocks in after 11:59 PM (between 12:00 AM and 6:00 AM)
  if (hour < 6) {
    isAbsent = true;
  }

  const insertData: any = {
    user_id: userId,
    full_name: fullName,
    date: dateStr,
    check_in_time: toLocalTimestamp(now),
    check_out_time: null,
    status: isAbsent ? "Absent" : "Checked In",
    working_seconds: 0,
    is_late: isLate,
    is_half_day: isLate, // Late comers automatically get a half day penalty
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
  
  const updatePayload: any = {
    check_out_time: toLocalTimestamp(new Date()),
    status: "Present",
    working_seconds: workingSeconds,
  };

  // Early Leaver Penalty: If total hours < 5 (18,000 seconds), mark as half day.
  // We only set it if true so we don't overwrite an existing 'true' from a late check-in.
  if (workingSeconds < 5 * 3600) {
    updatePayload.is_half_day = true;
  }

  await supabase
    .from("attendance")
    .update(updatePayload)
    .eq("id", docId);
};

export const getTodayAttendance = async (userId: string) => {
  const supabase = createClient();
  const dateStr = getLocalDateString();
  
  // Fetch the most recent attendance record for the user
  const { data } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  // 1. If the most recent shift is still active, return it (even if it started yesterday)
  if (data.status === "Checked In") {
    return fromRow(data);
  }

  // 2. If the shift is completed/closed, we only return it if it belongs to TODAY's date.
  // This prevents clocking in multiple times on the same calendar day, while
  // freeing up the 'Clock In' button for today if yesterday's shift is closed.
  if (data.date === dateStr) {
    return fromRow(data);
  }

  return null;
};

export const getAllTodayAttendance = async () => {
  const supabase = createClient();
  const dateStr = getLocalDateString();
  const { data, error } = await supabase.from("attendance").select("*").eq("date", dateStr);
  if (error) throw error;
  return (data || []).map(fromRow).filter(r => r.role !== "Admin");
};

export const getAttendanceByDate = async (dateStr: string) => {
  const supabase = createClient();
  const { data, error } = await supabase.from("attendance").select("*").eq("date", dateStr);
  if (error) throw error;
  return (data || []).map(fromRow).filter(r => r.role !== "Admin");
};

export const getUserAttendanceForMonth = async (userId: string, yearMonth: string) => {
  const supabase = createClient();
  
  // 1. Fetch user profile for dummy records
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", userId).maybeSingle();
  if (!profile) return [];
  if (profile.role === "Admin") return [];

  // 2. Fetch actual attendance records
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
  
  const existingRecords = (data || []).map(fromRow);
  const existingDates = new Set(existingRecords.map(r => r.date));
  
  // 3. Generate dates for the month up to today
  const [year, month] = yearMonth.split('-');
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const todayStr = getLocalDateString();
  
  const paddedRecords = [...existingRecords];
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${month}-${String(d).padStart(2, '0')}`;
    
    // Don't pad future dates
    if (dateStr > todayStr) continue;
    
    if (!existingDates.has(dateStr)) {
      const dDate = new Date(Number(year), Number(month) - 1, d);
      const isWeekend = dDate.getDay() === 0 || dDate.getDay() === 6;
      paddedRecords.push({
        id: (isWeekend ? "weekoff-" : "absent-") + profile.id + "-" + dateStr,
        userId: profile.id,
        fullName: profile.full_name,
        role: profile.role,
        date: dateStr,
        checkInTime: null,
        checkOutTime: null,
        status: isWeekend ? "Week Off" : "Absent",
        workingSeconds: 0,
        isLate: false,
        isHalfDay: false,
      });
    }
  }
  
  // Sort descending by date
  paddedRecords.sort((a, b) => b.date.localeCompare(a.date));
  
  return paddedRecords;
};

export const updateAttendanceStatus = async (
  id: string, 
  status: string, 
  isHalfDay: boolean,
  userId?: string,
  dateStr?: string,
  fullName?: string,
  role?: string
) => {
  const supabase = createClient();
  
  if ((id.startsWith('absent-') || id.startsWith('weekoff-')) && userId && dateStr) {
    // This record doesn't exist in the DB yet, insert it
    const { error } = await supabase.from("attendance").insert({
      user_id: userId,
      full_name: fullName || 'Unknown',
      role: role || 'Employee',
      date: dateStr,
      status: status,
      is_half_day: isHalfDay,
      working_seconds: 0
    });
    if (error) throw error;
  } else {
    // Update existing record
    const { error } = await supabase
      .from("attendance")
      .update({ 
        status, 
        is_half_day: isHalfDay,
        working_seconds: status === 'Absent' ? 0 : undefined 
      })
      .eq("id", id);
      
    if (error) throw error;
  }
};



