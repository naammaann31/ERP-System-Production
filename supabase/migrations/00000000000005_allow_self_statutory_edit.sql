-- ============================================================================
-- Fix: employees can self-report their own Aadhar/PAN/bank details via the
-- Documents page (this is real existing app functionality). Only
-- role/status/employee_id/job_role/designation/department — the
-- organizationally-assigned fields with no self-edit UI anywhere in the
-- app — should remain Admin/HR-only.
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
    then
      raise exception 'Only Admin or HR can change role, status, or employment details.';
    end if;
  end if;
  return new;
end;
$$;
