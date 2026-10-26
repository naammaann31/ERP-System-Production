-- ============================================================================
-- Close the direct-write gap on `attendance`.
--
-- Problem (confirmed by reading the live policy SQL, not assumed): today,
-- attendance_insert and attendance_update (migration 26) read
--   with check / using (user_id = auth.uid() or is_admin_or_full_hr())
-- which checks OWNERSHIP only — not which columns or values are being
-- written. So any authenticated employee can bypass clock_in()/clock_out()
-- entirely and send a direct REST request to write arbitrary values to
-- their own row (fabricate "Present" with any check_in_time/working_seconds,
-- clear is_half_day, or insert a brand-new fully-fabricated row for a past
-- date that has no record at all). This affects payroll (LOP, half-day
-- deductions), so it's a real, not theoretical, integrity gap.
--
-- Fix: move every remaining self-service write behind a narrow, validating
-- SECURITY DEFINER function, then remove the self-row clause from the
-- table's own INSERT/UPDATE policies so a direct write is only ever
-- possible for Admin/HR (unchanged from today — updateAttendanceStatus(),
-- the HR correction workflow in lib/attendance.ts, already relies solely
-- on is_admin_or_full_hr(), never on the self-row clause being removed
-- here, so it is completely unaffected by this migration).
--
-- Audited before writing this (exhaustive grep across every .ts/.tsx file
-- in the repo for `from("attendance")` and for callers of checkIn(),
-- checkOut(), updateWorkingSeconds()):
--   - checkIn() / checkOut() (lib/attendance.ts) — the OLD direct-write
--     versions — have ZERO live callers anywhere in the codebase. Dead
--     code. Narrowing the policies they relied on has no live effect.
--   - updateWorkingSeconds() (lib/attendance.ts) — the ONLY still-live
--     direct self-write — is called every tick by LiveAttendanceCard.tsx
--     and EmployeeAttendanceDashboard.tsx while an employee is checked in.
--     This migration adds update_working_seconds() below specifically so
--     that call keeps working unchanged; lib/attendance.ts is updated in
--     the same change-set to call it instead of writing the table
--     directly.
--   - lib/payroll.ts and lib/dashboardQueries.ts only ever .select() from
--     this table — confirmed no writes.
--   - app/api/cron/auto-clock-out/route.ts uses the service-role client,
--     which bypasses RLS entirely — unaffected by, and not touched by,
--     this migration, per standing instruction.
--
-- ============================================================================
-- DEPLOY ORDER — READ BEFORE RUNNING:
-- Do NOT run this migration until the frontend change that points
-- updateWorkingSeconds() at the new update_working_seconds() RPC (instead
-- of writing the table directly) has been deployed to production. The
-- live ticker call is the one still-active self-write this migration
-- closes off at the RLS layer; if this migration runs before that
-- frontend change ships, the live ticker will start failing for every
-- real employee who is currently checked in, because its direct write
-- will be rejected by RLS until the function exists AND the deployed
-- frontend is actually calling it.
-- ============================================================================
--
-- Does NOT touch: app/api/cron/auto-clock-out/route.ts, vercel.json,
-- updateAttendanceStatus(), attendance_select, attendance_delete, any
-- other table's RLS, or any existing column/type. Purely: two functions
-- switched from INVOKER to DEFINER (no change in what they permit — both
-- already do their own internal auth.uid() checks and accept no
-- attacker-controlled identity parameter), one new narrow DEFINER
-- function added, and the self-row clause removed from two policies.
-- ============================================================================

-- 1. clock_in(): INVOKER -> DEFINER. Body is otherwise byte-for-byte
--    identical to migration 33 — only the security mode changed.
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
  v_designation text;
  v_now timestamp;
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

  if v_hour < 6 then
    v_date := (v_now - interval '6 hours')::date;
  else
    v_date := v_now::date;
  end if;

  v_is_immigration := (v_role = 'IMMIGRATION' or v_designation = 'Immigration HR');

  if v_is_immigration then
    v_dow := extract(dow from v_date);
    v_daynum := extract(day from v_date);
    v_is_week_off := (v_dow = 0) or (v_dow = 6 and v_daynum between 22 and 28);
  else
    v_is_week_off := false;
  end if;

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

  select * into v_result from public.attendance
  where user_id = v_uid and date = v_date;

  return v_result;
end;
$$;

revoke all on function public.clock_in() from public;
grant execute on function public.clock_in() to authenticated;


-- 2. clock_out(): INVOKER -> DEFINER. Body is otherwise byte-for-byte
--    identical to migration 33 (including both fixes already applied
--    there — the split SELECTs, and floor() for working_seconds).
create or replace function public.clock_out(p_attendance_id uuid)
returns public.attendance
language plpgsql
security definer
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
    return v_record;
  end if;

  v_now := (now() at time zone 'Asia/Kolkata');

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


-- 3. New, narrow DEFINER function for the live working-seconds ticker.
--    Replicates exactly what the current direct client UPDATE does
--    (set working_seconds on the caller's own row) — nothing more — plus
--    the ownership/state checks that used to come from RLS's self-row
--    clause, which this migration removes from the table's own policy.
--    Does not touch check_in_time, check_out_time, status, is_late, or
--    is_half_day — those remain changeable only by clock_in()/clock_out()
--    or by Admin/HR via updateAttendanceStatus().
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


-- 4. Close the direct-write door. Admin/HR's existing correction workflow
--    (updateAttendanceStatus()) already relies solely on
--    is_admin_or_full_hr() and is completely unaffected. attendance_select
--    and attendance_delete are untouched.
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (public.is_admin_or_full_hr());

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated
  using (public.is_admin_or_full_hr());
