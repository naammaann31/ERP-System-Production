-- ============================================================================
-- Attendance Shifts: data-driven shift assignment, replacing role-inferred
-- shift logic. Adds a 3rd shift (Mid Shift) and makes shift an explicit,
-- per-employee, HR/Admin-controlled assignment instead of something derived
-- from `role`/`designation` string matching.
--
-- SUPERSEDES migration 00000000000034 — do NOT run 34 separately. Every
-- change 34 made (SECURITY DEFINER clock_in/clock_out, update_working_seconds(),
-- the RLS lockdown) is carried forward here unchanged, plus the new
-- shift-table logic layered on top. Running 34 before this is harmless
-- (this migration's CREATE OR REPLACE statements simply supersede it again),
-- but it is not necessary — this file is self-contained from migration 33's
-- baseline.
--
-- NOT APPLIED AUTOMATICALLY — run manually, per this project's convention,
-- only after review.
--
-- ============================================================================
-- Why a table instead of a third hardcoded branch
-- ============================================================================
-- Before this migration, "which shift is this employee on" was answered by
-- re-deriving it from role/designation independently in ~11 separate places
-- (lib/attendanceRules.ts, lib/attendance.ts, clock_in()/clock_out(), the
-- cron route, and three display components). Adding a 3rd shift the same
-- way would mean editing all of them again, in two languages, for every
-- future shift. This migration makes shift assignment an explicit
-- `profiles.shift_id` foreign key and shift RULES (cutoffs, thresholds,
-- week-off pattern) live in one `shifts` table that every caller reads from
-- — adding a 4th shift later means inserting one row, not editing N files.
--
-- ============================================================================
-- Exact behavior-preservation check for the two existing shifts (verified
-- by hand, value by value, before writing the generic SQL below):
--
-- Night Shift   : start 19:30, late_after 19:45, end 04:30, cutoff 05:00
--                 (next day), half-day threshold 18000s, early-absent
--                 trigger before hour 6, standard Sat/Sun week-off
--                 (display-only — does not suppress late-marking or exempt
--                 half-day, exactly as today), no Saturday-specific cutoff.
-- Immigration   : start 10:00, late_after 10:15, end 18:00, cutoff 18:45
--                 (same day), Saturday cutoff 15:30, half-day threshold
--                 18000s, no early-absent trigger, week-off = Sunday or the
--                 4th Saturday (22-28) — THIS shift's week-off DOES suppress
--                 late-marking, exempts the half-day penalty, and makes the
--                 cron skip it entirely, exactly as today.
-- Mid Shift (new): start 14:00, late_after 14:15, end 23:00, cutoff 23:30
--                 (same day, 30 min grace past end time, per explicit
--                 instruction), half-day threshold 18000s, no early-absent
--                 trigger (explicitly not required), standard Sat/Sun
--                 week-off, display-only (mirrors Night Shift's treatment,
--                 per explicit instruction — "normal" week-off, no
--                 exemption).
--
-- The date-rollback rule ("if clock-in hour < 6 AM, file it under
-- yesterday's calendar date") is deliberately left UNCONDITIONAL and
-- untouched — exactly as it already behaves today, for every shift,
-- regardless of shift_id. It is not generalized or shift-gated, specifically
-- to guarantee zero behavior change for Night Shift and Immigration. Mid
-- Shift simply inherits the same pre-existing, already-documented quirk
-- (CLAUDE.md section 8.A) — which cannot practically fire for Mid Shift
-- anyway, since its late cutoff (2:15 PM) is nowhere near that window.
--
-- Does NOT touch: app/api/cron/auto-clock-out/route.ts's authentication
-- (CRON_SECRET check), its use of the service-role client, or its overall
-- per-row-safe-update structure — only its shift-cutoff branching logic
-- changes, from a hardcoded if/else to a table lookup, per explicit
-- authorization for this one change. Does NOT touch updateAttendanceStatus()
-- (HR correction path), attendance_select, attendance_delete, or any other
-- table's RLS.
-- ============================================================================


-- ============================================================================
-- 1. shifts table
-- ============================================================================
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_time time not null,
  late_after_time time not null,
  shift_end_time time not null,
  auto_clockout_cutoff_time time not null,
  cutoff_is_next_day boolean not null default false,
  saturday_clockout_cutoff_time time,
  half_day_threshold_seconds integer not null default 18000,
  has_early_absent_trigger boolean not null default false,
  early_absent_before_hour integer,
  week_off_rule text not null default 'standard_weekend'
    check (week_off_rule in ('standard_weekend', 'sunday_plus_4th_saturday')),
  week_off_affects_rules boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.shifts is
  'Shift definitions — the single source of truth for cutoff times, late/absent/half-day thresholds, and week-off pattern. Assigned to an employee via profiles.shift_id, not inferred from role/designation.';

alter table public.shifts enable row level security;

create policy shifts_select on public.shifts
  for select to authenticated using (true);

-- No insert/update/delete policy for `authenticated` — shift definitions
-- are seeded below and not editable via the app in this phase (only
-- per-employee ASSIGNMENT is). Only service_role can change them.

-- Fixed, known ids (not gen_random_uuid()) specifically so profiles.shift_id
-- can later default to a plain literal — Postgres does not allow a
-- subquery inside a column DEFAULT expression ("cannot use subquery in
-- DEFAULT expression"), which is what the first version of this migration
-- tried and failed on, live, before reaching any further statement. The
-- Supabase SQL editor ran this whole file as one transaction, so that
-- failure rolled back everything, including this table and these rows —
-- confirmed by querying the live database afterward (0 rows, table not
-- found), not assumed.
insert into public.shifts (
  id, name, start_time, late_after_time, shift_end_time, auto_clockout_cutoff_time,
  cutoff_is_next_day, saturday_clockout_cutoff_time, half_day_threshold_seconds,
  has_early_absent_trigger, early_absent_before_hour, week_off_rule, week_off_affects_rules, sort_order
) values
  ('a1000000-0000-4000-8000-000000000001', 'Night Shift', '19:30', '19:45', '04:30', '05:00',
   true, null, 18000,
   true, 6, 'standard_weekend', false, 1),
  ('a1000000-0000-4000-8000-000000000002', 'Immigration Shift', '10:00', '10:15', '18:00', '18:45',
   false, '15:30', 18000,
   false, null, 'sunday_plus_4th_saturday', true, 2),
  ('a1000000-0000-4000-8000-000000000003', 'Mid Shift', '14:00', '14:15', '23:00', '23:30',
   false, null, 18000,
   false, null, 'standard_weekend', false, 3);


-- ============================================================================
-- 2. profiles.shift_id
-- ============================================================================
alter table public.profiles
  add column shift_id uuid references public.shifts(id) on delete restrict;

-- Backfill every existing employee to the shift that exactly reproduces
-- their current, already-live behavior — Immigration role/designation goes
-- to Immigration Shift, everyone else (including Admin, who doesn't use
-- attendance, but needs a non-null value to satisfy the NOT NULL added
-- below) goes to Night Shift, matching today's "else" branch exactly.
update public.profiles
set shift_id = 'a1000000-0000-4000-8000-000000000002'
where role = 'IMMIGRATION' or designation = 'Immigration HR';

update public.profiles
set shift_id = 'a1000000-0000-4000-8000-000000000001'
where shift_id is null;

alter table public.profiles
  alter column shift_id set not null,
  alter column shift_id set default 'a1000000-0000-4000-8000-000000000001';

-- shift_id is exactly as privileged as role/designation — must be added to
-- the existing protect_profile_fields() guard, or any employee could
-- self-select a more lenient shift directly via their own session (RLS's
-- profiles_update already permits a user to update their own row for any
-- column this trigger doesn't explicitly block).
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin_or_hr() then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.employee_id is distinct from old.employee_id
      or new.job_role is distinct from old.job_role
      or new.designation is distinct from old.designation
      or new.department is distinct from old.department
      or new.shift_id is distinct from old.shift_id
      or new.aadhar is distinct from old.aadhar
      or new.pan is distinct from old.pan
      or new.bank_account_name is distinct from old.bank_account_name
      or new.bank_details is distinct from old.bank_details
    then
      raise exception 'Only Admin or HR can change role, status, shift, or employment/statutory details.';
    end if;
  end if;
  return new;
end;
$$;


-- ============================================================================
-- 3. clock_in() — rewritten to be shift-table-driven. SECURITY DEFINER
--    (carried forward from migration 34).
-- ============================================================================
create or replace function public.clock_in()
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_full_name text;
  v_role text;
  v_shift_id uuid;
  v_shift public.shifts;
  v_now timestamp;
  v_date date;
  v_hour int;
  v_minute int;
  v_late_hour int;
  v_late_minute int;
  v_dow int;
  v_daynum int;
  v_is_week_off boolean;
  v_is_late boolean;
  v_is_absent boolean;
  v_result public.attendance;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Two separate single-target SELECTs, deliberately — not `select
  -- p.full_name, p.role, s.* into v_full_name, v_role, v_shift`. PL/pgSQL
  -- matches a multi-target INTO list positionally against every column in
  -- the result set, so mixing two scalar columns with a whole-row `s.*`
  -- (15 columns) would try to match 17 result columns against 3 targets —
  -- the exact bug already found once in migration 33's clock_out() and
  -- documented there; reproduced here during the shift-table rewrite and
  -- caught on review before being trusted.
  select full_name, role, shift_id into v_full_name, v_role, v_shift_id
  from public.profiles where id = v_uid;

  if v_full_name is null then
    raise exception 'Profile not found for current user' using errcode = 'P0002';
  end if;

  select * into v_shift from public.shifts where id = v_shift_id;

  if v_shift.id is null then
    raise exception 'No shift assigned for current user' using errcode = 'P0002';
  end if;

  v_now := (now() at time zone 'Asia/Kolkata');
  v_hour := extract(hour from v_now)::int;
  v_minute := extract(minute from v_now)::int;
  v_late_hour := extract(hour from v_shift.late_after_time)::int;
  v_late_minute := extract(minute from v_shift.late_after_time)::int;

  -- Date rollback — unconditional, unchanged from migration 33/34, applies
  -- to every shift exactly as it already does today. Not shift-gated; see
  -- the file-level comment above for why.
  if v_hour < 6 then
    v_date := (v_now - interval '6 hours')::date;
  else
    v_date := v_now::date;
  end if;

  -- Week-off: only computed/consulted when this shift's week-off pattern
  -- actually affects its rules (Immigration today; Night Shift and Mid
  -- Shift both leave this as display-only, exactly as Night Shift already
  -- does, so v_is_week_off never influences their late/absent outcome).
  if v_shift.week_off_affects_rules then
    v_dow := extract(dow from v_date);
    v_daynum := extract(day from v_date);
    if v_shift.week_off_rule = 'sunday_plus_4th_saturday' then
      v_is_week_off := (v_dow = 0) or (v_dow = 6 and v_daynum between 22 and 28);
    else
      v_is_week_off := (v_dow = 0) or (v_dow = 6);
    end if;
  else
    v_is_week_off := false;
  end if;

  -- Late / absent — generic form, verified by hand to reproduce Night
  -- Shift's and Immigration's exact existing truth tables (see migration
  -- file header comment). Compared as integer hour/minute, NOT as a raw
  -- `time` value comparison — the original hardcoded logic only ever
  -- looked at the whole minute (`extract(minute ...)::int`), with no
  -- sub-minute precision at all, so e.g. 19:45:30 was never late for
  -- Night Shift. A direct `time > time` comparison would include seconds
  -- and make that instant late when it shouldn't be — caught and avoided
  -- here specifically to match the pre-existing, whole-minute-only rule.
  if v_shift.has_early_absent_trigger and v_hour < v_shift.early_absent_before_hour then
    v_is_late := true;
    v_is_absent := true;
  else
    v_is_absent := false;
    if v_shift.week_off_affects_rules and v_is_week_off then
      v_is_late := false;
    else
      v_is_late := (v_hour > v_late_hour) or (v_hour = v_late_hour and v_minute > v_late_minute);
    end if;
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

  select * into v_result from public.attendance
  where user_id = v_uid and date = v_date;

  return v_result;
end;
$$;

revoke all on function public.clock_in() from public;
grant execute on function public.clock_in() to authenticated;


-- ============================================================================
-- 4. clock_out() — rewritten to be shift-table-driven. SECURITY DEFINER
--    (carried forward from migration 34). The designation sub-select that
--    migration 33/34 needed to disambiguate "Immigration HR" is gone —
--    shift_id is now the single authoritative source, so no more string
--    matching is needed at all.
-- ============================================================================
create or replace function public.clock_out(p_attendance_id uuid)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_record public.attendance;
  v_shift public.shifts;
  v_dow int;
  v_daynum int;
  v_is_week_off boolean;
  v_is_half_day boolean;
  v_now timestamp;
  v_working_seconds integer;
  v_result public.attendance;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_record from public.attendance where id = p_attendance_id;

  if v_record.id is not null then
    select s.* into v_shift
    from public.profiles p
    join public.shifts s on s.id = p.shift_id
    where p.id = v_record.user_id;
  end if;

  if v_record.id is null then
    raise exception 'Attendance record not found' using errcode = 'P0002';
  end if;

  if v_record.user_id <> v_uid then
    raise exception 'Cannot clock out another employee''s record' using errcode = '42501';
  end if;

  if v_record.status <> 'Checked In' then
    return v_record;
  end if;

  if v_shift.id is null then
    raise exception 'No shift assigned for this employee' using errcode = 'P0002';
  end if;

  v_now := (now() at time zone 'Asia/Kolkata');

  v_working_seconds := greatest(
    0,
    floor(extract(epoch from (v_now - v_record.check_in_time)))::integer
  );

  if v_shift.week_off_affects_rules then
    v_dow := extract(dow from v_record.date);
    v_daynum := extract(day from v_record.date);
    if v_shift.week_off_rule = 'sunday_plus_4th_saturday' then
      v_is_week_off := (v_dow = 0) or (v_dow = 6 and v_daynum between 22 and 28);
    else
      v_is_week_off := (v_dow = 0) or (v_dow = 6);
    end if;
  else
    v_is_week_off := false;
  end if;

  if v_working_seconds >= v_shift.half_day_threshold_seconds then
    v_is_half_day := false;
  elsif v_shift.week_off_affects_rules and v_is_week_off then
    v_is_half_day := false;
  else
    v_is_half_day := true;
  end if;

  update public.attendance
  set
    check_out_time = v_now,
    status = 'Present',
    working_seconds = v_working_seconds,
    is_half_day = (is_half_day or v_is_half_day)
  where id = p_attendance_id and user_id = v_uid and status = 'Checked In'
  returning * into v_result;

  if v_result.id is null then
    select * into v_result from public.attendance where id = p_attendance_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.clock_out(uuid) from public;
grant execute on function public.clock_out(uuid) to authenticated;


-- ============================================================================
-- 5. update_working_seconds() — identical to migration 34, carried forward
--    unchanged.
-- ============================================================================
create or replace function public.update_working_seconds(p_attendance_id uuid, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.attendance
  set working_seconds = greatest(0, p_seconds)
  where id = p_attendance_id
    and user_id = v_uid
    and status = 'Checked In';
end;
$$;

revoke all on function public.update_working_seconds(uuid, integer) from public;
grant execute on function public.update_working_seconds(uuid, integer) to authenticated;


-- ============================================================================
-- 6. Close the direct-write door — identical to migration 34, carried
--    forward unchanged. Admin/HR's existing correction workflow
--    (updateAttendanceStatus()) already relies solely on
--    is_admin_or_full_hr() and is completely unaffected.
-- ============================================================================
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (public.is_admin_or_full_hr());

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated
  using (public.is_admin_or_full_hr());
