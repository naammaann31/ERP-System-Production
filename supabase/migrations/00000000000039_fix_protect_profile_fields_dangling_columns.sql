-- ============================================================================
-- Fixes a regression introduced by migration 35.
--
-- protect_profile_fields() (the trigger that blocks non-admin users from
-- changing privileged profile fields) was re-created by migration 35 to add
-- shift_id to its guard, but from a stale copy of the function body that
-- still referenced aadhar/pan/bank_account_name/bank_details — four columns
-- that were DROPPED from public.profiles back in migration 14 (moved to
-- employee_private). migration 5 had already correctly removed those
-- references; migration 35's create-or-replace silently undid that fix.
--
-- Effect in production: any UPDATE on profiles made by a regular
-- (non-service-role, non-Admin/HR) user as themselves - e.g. uploading your
-- own avatar (lib/avatar.ts), or any other self-service Settings edit -
-- fires this trigger's body and crashes with Postgres error 42703
-- ("record \"new\" has no field \"aadhar\""), because `new`/`old` for the
-- profiles table simply have no such field anymore. Admin/HR-driven writes
-- (Edit Employee, etc.) were unaffected only because those go through
-- app/actions/employees.ts's service-role client, which short-circuits this
-- trigger's body entirely.
--
-- This migration is just migration 35's version of the function with those
-- four stale lines removed - shift_id stays, nothing else changes.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention,
-- only after review.
-- ============================================================================

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
    then
      raise exception 'Only Admin or HR can change role, status, shift, or employment details.';
    end if;
  end if;
  return new;
end;
$$;
