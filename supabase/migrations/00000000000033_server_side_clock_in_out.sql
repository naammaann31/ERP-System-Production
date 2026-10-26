-- ============================================================================
-- Server-authoritative Clock In / Clock Out.
--
-- NOT APPLIED AUTOMATICALLY — run manually, per this project's convention,
-- only after review.
--
-- Moves the official "is this on-time/late/absent/half-day" decision and the
-- official timestamp from the employee's own browser clock to Postgres's own
-- clock. Every rule below is a line-for-line port of lib/attendanceRules.ts
-- (determineCheckInFlags / determineCheckOutHalfDay / isImmigrationWeekOffDate),
-- which is itself a behavior-preserving extraction of the logic that was
-- already live in lib/attendance.ts's checkIn()/checkOut() — see the
-- "Clock In/Clock Out Server-Authoritative Migration" audit and design
-- review earlier in this project's history for the full rationale.
--
-- Does NOT touch: app/api/cron/auto-clock-out/route.ts, vercel.json, any
-- cron schedule/cutoff/behavior, updateAttendanceStatus() (the HR
-- correction path), updateWorkingSeconds() (the display-sync ticker), any
-- existing RLS policy, or any column type. Purely additive: two new
-- functions, nothing altered or dropped.
--
-- SECURITY INVOKER, not DEFINER: both functions only ever act on the
-- calling user's OWN attendance row (no user_id parameter exists on
-- either function — auth.uid() is read internally, never accepted as
-- input), which is already fully permitted by the existing
-- attendance_insert/attendance_update RLS policies
-- (`user_id = auth.uid() OR is_admin_or_full_hr()`, migration 26). There is
-- no privilege gap for DEFINER to bridge, so INVOKER is both sufficient and
-- strictly safer: it cannot bypass RLS by construction. Admin/HR continue
-- to use the existing, separate updateAttendanceStatus() correction
-- workflow — these two functions do not grant them (or anyone) the
-- ability to clock another employee in or out.
-- ============================================================================

create or replace function public.clock_in()
returns public.attendance
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_full_name text;
  v_role text;
  v_designation text;
  v_now timestamp;   -- IST wall-clock, no tz designator — matches toLocalTimestamp()'s existing storage convention exactly.
  v_date date;
  v_hour int;
  v_minute int;
  v_is_immigration boolean;
  v_is_week_off boolean;
  v_is_late boolean;
  v_is_absent boolean;
  v_dow int;
  v_daynum int;
  v_result public.attendance;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select full_name, role, designation into v_full_name, v_role, v_designation
  from public.profiles where id = v_uid;

  if v_full_name is null then
    raise exception 'Profile not found for current user' using errcode = 'P0002';
  end if;

  v_now := (now() at time zone 'Asia/Kolkata');
  v_hour := extract(hour from v_now)::int;
  v_minute := extract(minute from v_now)::int;

  -- Shift-day rollback — ported exactly as lib/attendance.ts's
  -- getLocalDateString() currently behaves (the <6 AM rule), not migration
  -- 16's stated "no offset" intent. That's a pre-existing discrepancy
  -- between a migration comment and the running code; this preserves
  -- current running behavior, not the stale comment.
  if v_hour < 6 then
    v_date := (v_now - interval '6 hours')::date;
  else
    v_date := v_now::date;
  end if;

  v_is_immigration := (v_role = 'IMMIGRATION' or v_designation = 'Immigration HR');

  if v_is_immigration then
    v_dow := extract(dow from v_date);     -- 0=Sunday .. 6=Saturday
    v_daynum := extract(day from v_date);
    v_is_week_off := (v_dow = 0) or (v_dow = 6 and v_daynum between 22 and 28);
  else
    v_is_week_off := false;
  end if;

  -- determineCheckInFlags, ported line-for-line.
  if v_is_immigration then
    v_is_late := (not v_is_week_off)
      and (v_hour > 10 or (v_hour = 10 and v_minute > 15));
    v_is_absent := false;
  else
    v_is_late := (v_hour > 19) or (v_hour = 19 and v_minute > 45) or (v_hour < 6);
    v_is_absent := (v_hour < 6);
  end if;

  insert into public.attendance (
    user_id, full_name, role, date,
    check_in_time, check_out_time, status,
    working_seconds, is_late, is_half_day
  ) values (
    v_uid, v_full_name, v_role, v_date,
    v_now, null, case when v_is_absent then 'Absent' else 'Checked In' end,
    0, v_is_late, v_is_late
  )
  on conflict (user_id, date) do nothing
  returning * into v_result;

  if v_result.id is not null then
    return v_result;
  end if;

  -- Lost the race (another tab/retry inserted first) — same "fetch what
  -- won" fallback the current client code already uses, now race-free at
  -- the database level via ON CONFLICT instead of select-then-insert.
  select * into v_result from public.attendance
  where user_id = v_uid and date = v_date;

  return v_result;
end;
$$;

revoke all on function public.clock_in() from public;
grant execute on function public.clock_in() to authenticated;


create or replace function public.clock_out(p_attendance_id uuid)
returns public.attendance
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_record public.attendance;
  v_designation text;
  v_is_immigration boolean;
  v_is_week_off boolean;
  v_dow int;
  v_daynum int;
  v_is_half_day boolean;
  v_now timestamp;
  v_working_seconds integer;
  v_result public.attendance;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Two separate single-target SELECTs, deliberately, rather than
  -- `select a.*, p.designation into v_record, v_designation` — that form
  -- mixes a whole-row target with an extra scalar column in the same INTO
  -- list, which PL/pgSQL matches positionally (13 result columns against
  -- 2 targets) rather than letting the record variable absorb the whole
  -- row, and fails at runtime. A single record target on its own (as used
  -- here, and as clock_in() already does with `returning * into v_result`)
  -- is the correct, unambiguous form.
  select * into v_record from public.attendance where id = p_attendance_id;

  if v_record.id is not null then
    select designation into v_designation from public.profiles where id = v_record.user_id;
  end if;

  if v_record.id is null then
    raise exception 'Attendance record not found' using errcode = 'P0002';
  end if;

  if v_record.user_id <> v_uid then
    raise exception 'Cannot clock out another employee''s record' using errcode = '42501';
  end if;

  if v_record.status <> 'Checked In' then
    -- Already closed (normal checkout, HR edit, or cron auto-close) — idempotent:
    -- a duplicate/retried request just returns the current row, never fights
    -- whatever already closed it (including an HR correction).
    return v_record;
  end if;

  v_now := (now() at time zone 'Asia/Kolkata');

  -- Server-derived from the stored check-in time, not trusted from the
  -- client — same number computeWorkedSeconds() already derives for any
  -- honest client, but immune to a tampered client-supplied duration.
  --
  -- floor(), not a plain ::integer cast: both v_now and check_in_time carry
  -- sub-second precision, so the raw difference can have a fractional
  -- remainder. Postgres's double-to-integer cast ROUNDS to the nearest
  -- whole number, not truncates — a plain cast could round e.g. 4h59m59.6s
  -- up to exactly 18000 seconds and wrongly credit a full 5 hours right at
  -- the boundary. computeWorkedSeconds() in lib/attendance.ts always floors
  -- (Math.floor) for exactly this reason; floor() here matches it exactly.
  v_working_seconds := greatest(
    0,
    floor(extract(epoch from (v_now - v_record.check_in_time)))::integer
  );

  v_is_immigration := (v_record.role = 'IMMIGRATION' or v_designation = 'Immigration HR');

  if v_is_immigration then
    v_dow := extract(dow from v_record.date);
    v_daynum := extract(day from v_record.date);
    v_is_week_off := (v_dow = 0) or (v_dow = 6 and v_daynum between 22 and 28);
  else
    v_is_week_off := false;
  end if;

  -- determineCheckOutHalfDay, ported line-for-line.
  if v_working_seconds >= 5 * 3600 then
    v_is_half_day := false;
  elsif v_is_immigration and v_is_week_off then
    v_is_half_day := false;
  else
    v_is_half_day := true;
  end if;

  update public.attendance
  set
    check_out_time = v_now,
    status = 'Present',
    working_seconds = v_working_seconds,
    -- OR against the existing value — never downgrades an existing true
    -- (e.g. from a late check-in) back to false. Same guarantee as the
    -- current client's "only set it if true" behavior.
    is_half_day = (is_half_day or v_is_half_day)
  where id = p_attendance_id and user_id = v_uid and status = 'Checked In'
  returning * into v_result;

  if v_result.id is null then
    -- Race: closed by another request (duplicate click, second tab, or an
    -- HR correction) between our SELECT and this UPDATE.
    select * into v_result from public.attendance where id = p_attendance_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.clock_out(uuid) from public;
grant execute on function public.clock_out(uuid) to authenticated;
