-- ============================================================================
-- Adds the 4th shift: Evening Shift, 4:00 PM - 1:00 AM (next day).
--
-- This is the first real test of the shift-table architecture's actual
-- payoff: clock_in(), clock_out(), and the cron all read shift rules
-- generically from this table already (confirmed by re-reading their
-- current, live definitions before writing this migration) — none of them
-- need to change at all. Adding a shift is genuinely just inserting one
-- row, which is exactly what this migration does.
--
-- Rules, as explicitly confirmed:
--   - Start 16:00, late after 16:15 (late -> half day, same as every shift).
--   - Half-day if worked < 5 hours (18000s) — same universal rule.
--   - No early-absent trigger (confirmed explicitly — same as Mid Shift).
--   - Standard Saturday/Sunday week-off, no exemption (confirmed explicitly
--     — same treatment as Night Shift and Mid Shift, NOT Immigration's
--     suppress-late/exempt-half-day/skip-cron behavior).
--   - No Saturday-specific cutoff override (confirmed explicitly).
--   - Auto-clockout cutoff 01:30, on the day AFTER the shift's own date —
--     cutoff_is_next_day = true, the same flag Night Shift already uses,
--     now proven to generalize correctly to a second, independently-timed
--     "crosses midnight" shift (the cron computes each row's cutoff from
--     its own shift config, so two different next-day cutoffs never
--     interfere with each other).
--
-- Fixed id (not gen_random_uuid()), consistent with the other three seed
-- shifts, so it stays stable and predictable if ever referenced directly.
--
-- NOT APPLIED AUTOMATICALLY — run manually, per this project's convention,
-- only after review.
-- ============================================================================

insert into public.shifts (
  id, name, start_time, late_after_time, shift_end_time, auto_clockout_cutoff_time,
  cutoff_is_next_day, saturday_clockout_cutoff_time, half_day_threshold_seconds,
  has_early_absent_trigger, early_absent_before_hour, week_off_rule, week_off_affects_rules, sort_order
) values (
  'a1000000-0000-4000-8000-000000000004', 'Evening Shift', '16:00', '16:15', '01:00', '01:30',
  true, null, 18000,
  false, null, 'standard_weekend', false, 4
);
