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

/**
 * Attendance is recorded in Indian time for everyone, always.
 *
 * Deriving it from the device clock would mean a laptop set to another
 * timezone — or simply set wrong — records a different day and time from
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
const istParts = (d: Date): Record<string, string> => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    // h23 rather than hour12:false — the latter renders midnight as "24"
    // in some engines, which would roll the date forward by a day.
    hourCycle: "h23",
  }).formatToParts(d);

  const out: Record<string, string> = {};
  for (const { type, value } of parts) out[type] = value;
  return out;
};

/**
 * Formats an instant as an IST wall-clock string — "YYYY-MM-DDTHH:mm:ss.sss",
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
 * timezone designator — and per the ECMAScript spec a date-time string with no
 * designator is parsed as local time, so the round trip is exact.
 *
 * A value that DOES carry a zone is honoured as written. That covers rows
 * created before the switch to wall-clock storage (they were UTC, tagged or
 * not — see migration 15, which shifted the untagged ones) and anything a
 * `timestamptz` column would return.
 */
export const parseTimestamp = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Stored values are IST wall-clock with no designator, so IST is attached
  // explicitly rather than letting Date assume the viewer's own timezone —
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
 * if the tick ever runs twice — which it did, so the clock advanced two
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

/**
 * Today's date in India, as YYYY-MM-DD.
 *
 * Plain calendar date: a clock-in at 04:20 on 14 Aug is filed under 14 Aug.
 * There is deliberately no shift-window adjustment — the previous version
 * treated anything before 7:30 PM as belonging to the previous day's shift,
 * which filed daytime clock-ins under yesterday's date and only made sense
 * if every employee worked the night shift. It rolls over at IST midnight.
 */
export const getLocalDateString = () => {
  const p = istParts(new Date());
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
 * hardcoded May–Sep 2026 array defaulting to "July 2026", so it opened on a
 * month with no records and stopped working entirely outside that window.
 */
export const getRecentMonthOptions = (count = 12): { value: string; label: string }[] => {
  const p = istParts(new Date());
  const year = Number(p.year);
  const month = Number(p.month);

  return Array.from({ length: count }, (_, i) => {
    // Built in UTC purely as calendar arithmetic — Date handles the year
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

  const insertData: any = {
    user_id: userId,
    full_name: fullName,
    date: dateStr,
    check_in_time: toLocalTimestamp(new Date()),
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
      check_out_time: toLocalTimestamp(new Date()),
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
