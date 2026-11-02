-- ============================================================================
-- Freezes leave accrual at the moment an employee goes Inactive.
--
-- Problem: calculateMonthsEmployed()/calculateAccruedLeaves() (lib/leave.ts)
-- compute accrued leave purely from date_of_joining vs. "now" — they have no
-- way to know an employee stopped working, so an Inactive employee's leave
-- balance kept growing by 2 days every month forever, visible on their HR
-- profile page (app/dashboard/employees/[uid]/page.tsx).
--
-- Fix: a new `inactive_since` timestamp, stamped automatically the moment
-- `status` flips to 'Inactive' (and cleared if reactivated), so the app code
-- can cap the accrual calculation at that date instead of "now". This is a
-- separate trigger from protect_profile_fields_trigger (migration 2) -
-- deliberately not touched, since it already does the correct authorization
-- check for who may change `status` in the first place; this one only reacts
-- to the value once a permitted change has happened.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention,
-- only after review.
-- ============================================================================

alter table public.profiles add column if not exists inactive_since timestamptz;

create or replace function public.stamp_inactive_since()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'Inactive' then
      new.inactive_since := now();
    elsif new.status = 'Active' then
      new.inactive_since := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_inactive_since_trigger on public.profiles;
create trigger stamp_inactive_since_trigger
  before update on public.profiles
  for each row execute function public.stamp_inactive_since();

-- One-time backfill: employees already marked Inactive before this migration
-- ran have no inactive_since yet (the trigger above only fires on a future
-- status change). Stamp them to now() as the best available approximation -
-- the real transition date isn't recorded anywhere, so this is "frozen from
-- today" rather than back-dated to when they actually left.
--
-- `where inactive_since is null` makes this safe to run more than once and
-- guarantees it never overwrites a real value the trigger already set
-- (e.g. if some rows were toggled Active->Inactive after this migration
-- file was written but before it was actually applied).
--
-- This UPDATE only ever touches the inactive_since column - the backfill
-- itself does not go through stamp_inactive_since_trigger's status check
-- (status isn't changing here), so no leave_requests/attendance/payroll
-- rows or any other profile field are touched, and nothing is deleted.
update public.profiles
set inactive_since = now()
where status = 'Inactive' and inactive_since is null;
