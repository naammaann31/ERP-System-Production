-- ============================================================================
-- Drop the 7:30 PM shift-window rule from the `date` column.
--
-- getLocalDateString() used to subtract a day from anything before 7:30 PM, so
-- the shift day reset at 19:30 rather than at midnight. That only held if every
-- employee worked the night shift: a clock-in at noon was filed under the
-- PREVIOUS calendar day, and one at 19:29 under the day before that.
--
-- `date` is now simply the Indian calendar date of the check-in, so it agrees
-- with check_in_time (which migration 15 made IST wall-clock, hence a plain
-- ::date cast is already the Indian date — no offset arithmetic here).
--
-- Runs after migration 15 and depends on it: doing this while check_in_time
-- was still UTC would file every late-evening IST check-in under the next day.
-- ============================================================================

-- `attendance` is unique (user_id, date). The old rule could file two shifts
-- under one date, or one shift under a date that recomputing would collide
-- with, so rows whose new date is already taken by another row for the same
-- user are left alone and reported instead of failing the whole migration.
do $$
declare
  conflicted int;
begin
  with recomputed as (
    select
      a.id,
      a.user_id,
      a.check_in_time::date as new_date
    from public.attendance a
    where a.check_in_time is not null
      and a.date is distinct from a.check_in_time::date
  ),
  safe as (
    select r.*
    from recomputed r
    where not exists (
      select 1
      from public.attendance other
      where other.user_id = r.user_id
        and other.date = r.new_date
        and other.id <> r.id
    )
  )
  update public.attendance a
  set date = s.new_date
  from safe s
  where a.id = s.id;

  select count(*) into conflicted
  from public.attendance a
  where a.check_in_time is not null
    and a.date is distinct from a.check_in_time::date;

  if conflicted > 0 then
    raise notice
      'attendance: % row(s) left unchanged because the recomputed date already exists for that user. Review with: select user_id, date, check_in_time from public.attendance where date is distinct from check_in_time::date;',
      conflicted;
  end if;
end $$;

comment on column public.attendance.date is
  'Indian calendar date of the check-in. Plain calendar date — no shift-window offset. See migration 16.';
