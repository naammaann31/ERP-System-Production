-- ============================================================================
-- Re-apply migration 18's intent: attendance_insert and attendance_update
-- had drifted back to using is_admin_or_hr() (which includes OPS_HR) instead
-- of is_admin_or_full_hr() (Admin/HR only) — confirmed live via the Supabase
-- dashboard policy editor, the third such drift found in this project after
-- interview_screening_entries and candidates_select.
--
-- Whether migration 18 was never actually run, or was run and then silently
-- overwritten by a later dashboard edit, the end result was the same: OPS_HR
-- currently has write access to other employees' attendance records, which
-- contradicts the project's intended design (OPS_HR can view attendance but
-- not create or edit it — confirmed as the desired behavior).
--
-- This re-applies migration 18's insert/update policies unchanged, and goes
-- one step further than migration 18 did: attendance_delete was never
-- narrowed by migration 18 in the first place — it was still is_admin_or_hr()
-- since the very first RLS migration, so OPS_HR could delete any employee's
-- attendance row (not just edit it) even when migration 18 was working as
-- intended. Explicit project-owner decision this pass: OPS_HR's view-all/
-- edit-none restriction should also mean delete-none, so attendance_delete
-- is narrowed here too, to Admin/HR only — no own-row clause is added for
-- delete, since that wasn't part of the original design and wasn't asked
-- for (nobody — including the employee themselves — deletes their own
-- attendance row; only Admin/HR can, same as before, just minus OPS_HR now).
--
-- The function itself is re-declared too (create or replace, safe to
-- re-run) in case migration 18 was never actually applied at all rather
-- than reverted.
-- ============================================================================

create or replace function public.is_admin_or_full_hr()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() in ('Admin', 'HR');
$$;

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin_or_full_hr());

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin_or_full_hr());

drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance
  for delete to authenticated
  using (public.is_admin_or_full_hr());
