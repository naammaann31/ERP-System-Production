-- ============================================================================
-- Fix: delete_employee() deleted the target's auth.users row, THEN tried to
-- write an audit log using the CALLER's own id. If the caller deleted their
-- own account, their profile row was already gone (cascaded) by the time
-- the log insert ran, violating the actor_uid FK and rolling back the
-- entire operation with a confusing error.
--
-- Fix: (1) never allow an admin to delete their own account — this is a
-- sensible guard regardless, since self-deletion via a bulk-select is an
-- accidental-lockout footgun, not a real use case; (2) write the audit log
-- BEFORE deleting, so ordering can never cause this class of failure again.
-- ============================================================================

create or replace function public.delete_employee(p_employee_uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
begin
  if not public.is_admin_or_hr() then
    raise exception 'Only Admin or HR can delete employees.';
  end if;

  if p_employee_uid = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  select full_name into v_actor_name from public.profiles where id = auth.uid();

  insert into public.audit_logs (actor_name, actor_uid, action, target)
  values (coalesce(v_actor_name, 'Unknown'), auth.uid(), 'Deleted Employee', p_employee_uid::text);

  delete from auth.users where id = p_employee_uid;
end;
$$;
