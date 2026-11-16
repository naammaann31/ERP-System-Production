-- ============================================================================
-- Adds `branch` to profiles — "Ahmedabad Branch" or "Vadodara Branch" — per
-- explicit instruction to add a Branch selector to Add/Edit Employee and a
-- Branch column to Vectra Team.
--
-- Every existing employee is backfilled to "Ahmedabad Branch" automatically:
-- in Postgres 11+, adding a NOT NULL column with a DEFAULT sets that default
-- for every pre-existing row as metadata (no table rewrite, no separate
-- UPDATE pass needed) - this is schema-only, not a data migration.
--
-- Employment-detail field, same class as shift_id/designation - added to
-- protect_profile_fields()'s guarded list (recreated here verbatim from
-- migration 39, plus this one line) so only Admin/HR, or the service-role
-- client app/actions/employees.ts already uses, can change it. A regular
-- employee can never self-assign their own branch, consistent with how
-- every other employment field on this table is already guarded.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention.
-- ============================================================================

alter table public.profiles
  add column branch text not null default 'Ahmedabad Branch'
  check (branch in ('Ahmedabad Branch', 'Vadodara Branch'));

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
      or new.branch is distinct from old.branch
    then
      raise exception 'Only Admin or HR can change role, status, shift, branch, or employment details.';
    end if;
  end if;
  return new;
end;
$$;
