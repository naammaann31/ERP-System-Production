import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLocalDateString } from "@/lib/attendance";

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

    const dateStr = getLocalDateString();
    
    // We want to target people who are still "Checked In" for the *current* business date 
    // at 5:00 AM. Since the business day rolls over at 6:00 AM, at 5:00 AM, 
    // `getLocalDateString()` correctly returns "yesterday's" date (e.g., Aug 1).
    
    // Fetch all active shifts
    const { data: activeShifts, error: fetchError } = await supabase
      .from("attendance")
      .select("id")
      .eq("status", "Checked In")
      .eq("date", dateStr);

    if (fetchError) throw fetchError;
    if (!activeShifts || activeShifts.length === 0) {
      return NextResponse.json({ message: "No active shifts to auto-clock-out" }, { status: 200 });
    }

    // Auto-Clock-Out Penalty: Set status to "Absent" and end shift at 5:00 AM.
    // 5:00 AM IST in local timestamp logic.
    const now = new Date(); // It is currently 5:00 AM
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(now);
    
    const parts: Record<string, string> = {};
    for (const { type, value } of p) parts[type] = value;
    
    const penaltyTimestamp = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000`;

    const shiftIds = activeShifts.map(shift => shift.id);

    const { error: updateError } = await supabase
      .from("attendance")
      .update({
        status: "Absent",
        check_out_time: penaltyTimestamp,
        // They forfeit their working seconds
      })
      .in("id", shiftIds);

    if (updateError) throw updateError;

    return NextResponse.json({ 
      message: "Successfully ran auto-clock-out guillotine",
      processed: shiftIds.length 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


