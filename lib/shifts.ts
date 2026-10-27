import { createClient } from "@/lib/supabase/client";
import { isWeekOffForRule, legacyIsImmigration } from "./attendanceRules";

export { legacyIsImmigration };

/**
 * Mirrors the `shifts` table (migration 00000000000035). This is the single
 * source of truth for shift rules — every caller reads from here instead of
 * re-deriving "which shift is this" from role/designation.
 */
export interface Shift {
  id: string;
  name: string;
  startTime: string; // "HH:MM:SS"
  lateAfterTime: string;
  shiftEndTime: string;
  autoClockoutCutoffTime: string;
  cutoffIsNextDay: boolean;
  saturdayClockoutCutoffTime: string | null;
  halfDayThresholdSeconds: number;
  hasEarlyAbsentTrigger: boolean;
  earlyAbsentBeforeHour: number | null;
  weekOffRule: "standard_weekend" | "sunday_plus_last_saturday";
  weekOffAffectsRules: boolean;
  sortOrder: number;
}

function fromRow(row: any): Shift {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    lateAfterTime: row.late_after_time,
    shiftEndTime: row.shift_end_time,
    autoClockoutCutoffTime: row.auto_clockout_cutoff_time,
    cutoffIsNextDay: row.cutoff_is_next_day,
    saturdayClockoutCutoffTime: row.saturday_clockout_cutoff_time,
    halfDayThresholdSeconds: row.half_day_threshold_seconds,
    hasEarlyAbsentTrigger: row.has_early_absent_trigger,
    earlyAbsentBeforeHour: row.early_absent_before_hour,
    weekOffRule: row.week_off_rule,
    weekOffAffectsRules: row.week_off_affects_rules,
    sortOrder: row.sort_order,
  };
}

let cachedShifts: Shift[] | null = null;
let inFlight: Promise<Shift[]> | null = null;

/**
 * Fetches all shift definitions, ordered for display. Cached in module
 * scope for the lifetime of the page — shift definitions are seeded by
 * migration and not editable via the app, so there is nothing to
 * invalidate the cache for.
 */
export const getShifts = async (): Promise<Shift[]> => {
  if (cachedShifts) return cachedShifts;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .order("sort_order", { ascending: true });
    inFlight = null;
    if (error) throw error;
    cachedShifts = (data || []).map(fromRow);
    return cachedShifts;
  })();

  return inFlight;
};

/**
 * Thin wrapper over attendanceRules.ts's isWeekOffForRule(), typed against
 * a full Shift object for convenience at call sites that already have one.
 */
export function isWeekOffForShift(
  shift: Pick<Shift, "weekOffRule">,
  year: number,
  month1Indexed: number,
  day: number
): boolean {
  return isWeekOffForRule(shift.weekOffRule, year, month1Indexed, day);
}
