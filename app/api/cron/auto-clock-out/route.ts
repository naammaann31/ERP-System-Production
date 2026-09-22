import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeWorkedSeconds } from "@/lib/attendance";

// We use the service role key to bypass RLS in the cron job
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // MUST have this in Vercel env vars!
);

export async function GET(request: Request) {
  try {
    // 1. Verify cron secret to prevent unauthorized execution
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch all active shifts (any date, as long as they are still Checked In)
    const { data: activeShifts, error: fetchError } = await supabase
      .from("attendance")
      .select("id, date, check_in_time")
      .eq("status", "Checked In");

    if (fetchError) throw fetchError;
    if (!activeShifts || activeShifts.length === 0) {
      return NextResponse.json({ message: "No active shifts to process" }, { status: 200 });
    }

    const nowMs = Date.now();
    let processedCount = 0;

    // 3. Process each shift individually
    for (const shift of activeShifts) {
      if (!shift.date || !shift.check_in_time) continue;

      // Calculate the official cutoff: 5:00 AM IST on the morning FOLLOWING the shift date.
      // Parse shift.date safely using UTC to avoid server timezone drift.
      const [yStr, mStr, dStr] = shift.date.split('-');
      const shiftDate = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));
      
      // Advance to the next day
      shiftDate.setUTCDate(shiftDate.getUTCDate() + 1);
      
      const nextY = shiftDate.getUTCFullYear();
      const nextM = String(shiftDate.getUTCMonth() + 1).padStart(2, '0');
      const nextD = String(shiftDate.getUTCDate()).padStart(2, '0');

      // Absolute timestamp string with +05:30 offset for strict comparison
      const cutoffTimestamp = `${nextY}-${nextM}-${nextD}T05:00:00+05:30`;
      const cutoffMs = new Date(cutoffTimestamp).getTime();

      // Safety check: If current time is BEFORE the cutoff, do NOT auto-clock out.
      if (nowMs < cutoffMs) {
        continue;
      }

      // 4. Calculate actual worked seconds up to exactly 5:00 AM.
      // The DB uses wall-clock time strings without timezone designators.
      const localCheckoutTime = `${nextY}-${nextM}-${nextD}T05:00:00.000`;
      
      const workingSeconds = computeWorkedSeconds({
        checkInTime: shift.check_in_time,
        checkOutTime: localCheckoutTime,
        workingSeconds: 0
      });

      // 5. Update the shift
      const { error: updateError } = await supabase
        .from("attendance")
        .update({
          status: "Absent",
          check_out_time: localCheckoutTime,
          working_seconds: workingSeconds,
          is_half_day: false,
          is_late: false
        })
        .eq("id", shift.id);

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
