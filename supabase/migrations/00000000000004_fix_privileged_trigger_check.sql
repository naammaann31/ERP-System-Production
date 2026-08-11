-- ============================================================================
-- Fix: handle_new_user / protect_profile_fields must key off auth.role()
-- ('service_role' for trusted server-side calls), not client-supplied
-- metadata or the (nonexistent, for brand-new users) admin check.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_privileged boolean := auth.role() = 'service_role';
begin
  insert into public.profiles (id, full_name, email, role, employee_id, job_role, designation, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case when v_privileged then coalesce(new.raw_user_meta_data->>'role', 'Employee') else 'Employee' end,
    case when v_privileged then new.raw_user_meta_data->>'employee_id' else null end,
    case when v_privileged then new.raw_user_meta_data->>'job_role' else null end,
    case when v_privileged then new.raw_user_meta_data->>'designation' else null end,
    case when v_privileged then new.raw_user_meta_data->>'department' else null end
  );
  return new;
end;
$$;

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
      or new.aadhar is distinct from old.aadhar
      or new.pan is distinct from old.pan
      or new.bank_account_name is distinct from old.bank_account_name
      or new.bank_details is distinct from old.bank_details
    then
      raise exception 'Only Admin or HR can change role, status, or employment/statutory details.';
    end if;
  end if;
  return new;
end;
$$;
