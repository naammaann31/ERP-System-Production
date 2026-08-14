-- ============================================================================
-- Convert existing attendance timestamps from UTC to IST wall-clock.
--
-- `check_in_time` / `check_out_time` are `timestamp` WITHOUT time zone on the
-- live database. (Note the drift: migration 1 declares these as `timestamptz`,
-- but the live columns are plain `timestamp`. This migration does not change
-- the type — it only rewrites the values — so that drift is still outstanding.)
--
-- Until now the app wrote `new Date().toISOString()` into them, i.e. UTC. A
-- 04:13 IST check-in was therefore stored as 22:43 the previous day, which read
-- correctly in the UI but was unreadable in the table editor, where the raw
-- value is shown as-is.
--
-- The app now writes local wall-clock instead (lib/attendance.ts,
-- toLocalTimestamp), so a 04:13 check-in is stored as 04:13. Every row written
-- BEFORE that change is UTC and must be shifted forward by the IST offset,
-- or the new reader — which parses these values as local time — would report
-- them 5:30 early.
--
-- This is a one-shot data rewrite. It is NOT idempotent: running it twice
-- would shift the same rows twice. It is safe only because every row that
-- exists when it runs was written by the old UTC code path.
--
-- The offset is a fixed +05:30. India does not observe daylight saving, so a
-- constant interval is exact for every historical row; this would need
-- `at time zone` handling in a DST-observing region.
-- ============================================================================

update public.attendance
set
  check_in_time  = check_in_time  + interval '5 hours 30 minutes',
  check_out_time = check_out_time + interval '5 hours 30 minutes'
where check_in_time is not null
   or check_out_time is not null;

comment on column public.attendance.check_in_time is
  'Local (IST) wall-clock time, NOT UTC. Written by toLocalTimestamp() in lib/attendance.ts and parsed back as local time. See migration 15.';

comment on column public.attendance.check_out_time is
  'Local (IST) wall-clock time, NOT UTC. See migration 15.';
