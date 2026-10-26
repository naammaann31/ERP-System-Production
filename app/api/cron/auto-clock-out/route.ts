import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeWorkedSeconds } from "@/lib/attendance";

// We use the service role key to bypass RLS in the cron job
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // MUST have this in Vercel env vars!
);

interface ShiftRow {
  id: string;
  name: string;
  auto_clockout_cutoff_time: string; // "HH:MM:SS"
  cutoff_is_next_day: boolean;
  saturday_clockout_cutoff_time: string | null;
  week_off_rule: "standard_weekend" | "sunday_plus_4th_saturday";
  week_off_affects_rules: boolean;
}

function parseHourMinute(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":");
  return { hour: Number(h), minute: Number(m) };
}

function isWeekOffDate(rule: "standard_weekend" | "sunday_plus_4th_saturday", dayOfWeek: number, dateNum: number): boolean {
  if (rule === "sunday_plus_4th_saturday") {
    return dayOfWeek === 0 || (dayOfWeek === 6 && dateNum >= 22 && dateNum <= 28);
  }
  return dayOfWeek === 0 || dayOfWeek === 6;
}

export async function GET(request: Request) {
  try {
    // 1. Verify cron secret to prevent unauthorized execution
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch shift definitions once (small, fixed table) so each row below
    // can look up its own cutoff instead of a hardcoded two-way branch —
    // this is what lets a new shift (or a 4th, 5th, ...) work here without
    // this file changing again.
    const { data: shiftRows, error: shiftsError } = await supabase
      .from("shifts")
      .select("id, name, auto_clockout_cutoff_time, cutoff_is_next_day, saturday_clockout_cutoff_time, week_off_rule, week_off_affects_rules");
    if (shiftsError) throw shiftsError;
    const shiftsById = new Map<string, ShiftRow>((shiftRows || []).map((s) => [s.id, s as ShiftRow]));
    const nightShiftFallback = (shiftRows || []).find((s) => s.name === "Night Shift") as ShiftRow | undefined;
    const immigrationShiftFallback = (shiftRows || []).find((s) => s.name === "Immigration Shift") as ShiftRow | undefined;

    // 3. Fetch all active shifts (any date, as long as they are still Checked In)
    const { data: activeShifts, error: fetchError } = await supabase
      .from("attendance")
      .select("id, date, check_in_time, role, profiles(shift_id, designation)")
      .eq("status", "Checked In");

    if (fetchError) throw fetchError;
    if (!activeShifts || activeShifts.length === 0) {
      return NextResponse.json({ message: "No active shifts to process" }, { status: 200 });
    }

    const nowMs = Date.now();
    let processedCount = 0;

    // 4. Process each shift individually
    for (const row of activeShifts) {
      if (!row.date || !row.check_in_time) continue;

      const profileShiftId = (row.profiles as any)?.shift_id as string | undefined;
      const designation = (row.profiles as any)?.designation;

      // Primary path: look up the employee's actual assigned shift.
      // Fallback: if a row somehow has no matching shift (should not
      // happen after the migration 35 backfill, since shift_id is NOT
      // NULL), reproduce the exact pre-shift-table two-way logic so a
      // missing join never silently stops someone being auto-clocked-out.
      const shift: ShiftRow | undefined =
        (profileShiftId && shiftsById.get(profileShiftId)) ||
        (row.role === "IMMIGRATION" || designation === "Immigration HR" ? immigrationShiftFallback : nightShiftFallback);

      if (!shift) continue; // no shift data available at all — skip rather than guess

      const [yStr, mStr, dStr] = row.date.split('-');
      const shiftDate = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));

      const dayOfWeek = shiftDate.getUTCDay();
      const dateNum = shiftDate.getUTCDate();

      // Week-off skip — only for shifts whose week-off actually affects
      // their rules (Immigration today), exactly as before: Night Shift
      // and Mid Shift never skip here, even on a real Saturday/Sunday.
      if (shift.week_off_affects_rules && isWeekOffDate(shift.week_off_rule, dayOfWeek, dateNum)) {
        continue;
      }

      // Cutoff date: shifts that cross midnight (Night Shift) force-close
      // on the FOLLOWING calendar day; same-day shifts (Immigration, Mid
      // Shift) force-close on their own date.
      const cutoffDate = new Date(shiftDate);
      if (shift.cutoff_is_next_day) {
        cutoffDate.setUTCDate(cutoffDate.getUTCDate() + 1);
      }

      // Saturday-specific cutoff (only Immigration has one today) only
      // applies on an actual Saturday that reached this point — i.e. one
      // that wasn't already skipped above as a week-off Saturday.
      const useSaturdayCutoff = dayOfWeek === 6 && !!shift.saturday_clockout_cutoff_time;
      const { hour: cutoffHour, minute: cutoffMinute } = parseHourMinute(
        useSaturdayCutoff ? shift.saturday_clockout_cutoff_time! : shift.auto_clockout_cutoff_time
      );

      const cutoffY = cutoffDate.getUTCFullYear();
      const cutoffM = String(cutoffDate.getUTCMonth() + 1).padStart(2, '0');
      const cutoffD = String(cutoffDate.getUTCDate()).padStart(2, '0');
      const hh = String(cutoffHour).padStart(2, '0');
      const mm = String(cutoffMinute).padStart(2, '0');

      const cutoffTimestamp = `${cutoffY}-${cutoffM}-${cutoffD}T${hh}:${mm}:00+05:30`;
      const localCheckoutTime = `${cutoffY}-${cutoffM}-${cutoffD}T${hh}:${mm}:00.000`;

      const cutoffMs = new Date(cutoffTimestamp).getTime();

      // Safety check: If current time is BEFORE the cutoff, do NOT auto-clock out.
      if (nowMs < cutoffMs) {
        continue;
      }

      // 5. Calculate actual worked seconds up to exactly the cutoff time.
      const workingSeconds = computeWorkedSeconds({
        checkInTime: row.check_in_time,
        checkOutTime: localCheckoutTime,
        workingSeconds: 0
      });

      // 6. Update the shift
      const { error: updateError } = await supabase
        .from("attendance")
        .update({
          status: "Absent",
          check_out_time: localCheckoutTime,
          working_seconds: workingSeconds,
          is_half_day: false,
          is_late: false
        })
        .eq("id", row.id);

      if (updateError) throw updateError;
      processedCount++;
    }

    return NextResponse.json({
      message: "Successfully ran auto-clock-out check",
      processed: processedCount
    }, { status: 200 });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
