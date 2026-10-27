-- ============================================================================
-- Fix: Immigration Shift's week-off rule was "the Saturday whose date number
-- falls in 22-28" — which is always the 4th Saturday of the month, but is
-- NOT always the LAST Saturday. Any month where the 1st Saturday falls on
-- the 1st, 2nd, or 3rd (and the month has enough days) has a 5th Saturday,
-- which the old rule never recognized as a week-off at all.
--
-- Concrete, currently-live example this was verified against: October 2026
-- has Saturdays on the 3rd, 10th, 17th, 24th, and 31st (5 Saturdays). The
-- old rule marked the 24th (the 4th Saturday) as the week-off day and left
-- the 31st (the true last Saturday) as a normal working day — backwards
-- from what was intended.
--
-- Fix: replace the date-range check with a real "is this the last Saturday
-- of its month" computation — true whenever adding 7 days rolls into the
-- next calendar month. Scoped strictly to Immigration Shift's week-off
-- rule; nothing else in this migration touches Night Shift, Mid Shift, or
-- anything unrelated.
--
-- NOT APPLIED AUTOMATICALLY — run manually, per this project's convention,
-- only after review.
-- ============================================================================

-- 1. The enum value name itself said "4th_saturday", which would now be a
--    misleading label for what the rule actually computes — rename it
--    rather than let the name and behavior silently diverge (this project
--    has been bitten by exactly that class of drift before). Existing rows
--    must be updated to the new value BEFORE the stricter constraint is
--    added, or the add would fail validation against the old value.
alter table public.shifts drop constraint if exists shifts_week_off_rule_check;

update public.shifts
set week_off_rule = 'sunday_plus_last_saturday'
where week_off_rule = 'sunday_plus_4th_saturday';

alter table public.shifts
  add constraint shifts_week_off_rule_check
  check (week_off_rule in ('standard_weekend', 'sunday_plus_last_saturday'));


-- ============================================================================
-- 2. clock_in() — same function, only the week-off computation inside it
--    changes. Everything else (late/absent logic, date rollback, insert
--    shape) is untouched.
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
  v_is_week_off boolean;
  v_is_late boolean;
  v_is_absent boolean;
  v_result public.attendance;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

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

  if v_hour < 6 then
    v_date := (v_now - interval '6 hours')::date;
  else
    v_date := v_now::date;
  end if;

  if v_shift.week_off_affects_rules then
    v_dow := extract(dow from v_date);
    if v_shift.week_off_rule = 'sunday_plus_last_saturday' then
      -- True "last Saturday of this month": adding 7 days rolls into the
      -- following calendar month. Works across year boundaries too, since
      -- only the month number is compared, not the year.
      v_is_week_off := (v_dow = 0) or (v_dow = 6 and extract(month from (v_date + 7)) <> extract(month from v_date));
    else
      v_is_week_off := (v_dow = 0) or (v_dow = 6);
    end if;
  else
    v_is_week_off := false;
  end if;

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
-- 3. clock_out() — same, only the week-off computation changes.
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
    if v_shift.week_off_rule = 'sunday_plus_last_saturday' then
      v_is_week_off := (v_dow = 0) or (v_dow = 6 and extract(month from (v_record.date + 7)) <> extract(month from v_record.date));
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
