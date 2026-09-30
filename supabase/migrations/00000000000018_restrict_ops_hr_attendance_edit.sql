-- OPS_HR should be able to view every employee's attendance (unchanged --
-- attendance_select already allows all authenticated users to read), but
-- should no longer be able to create or change someone else's attendance
-- status (Present/Absent/Half Day/Week Off). Only Admin and HR keep that
-- power. Employees (including OPS_HR) can still manage their own row via
-- the `user_id = auth.uid()` clause, so normal clock-in/out is unaffected.
--
-- We intentionally do NOT touch public.is_admin_or_hr(), since that
-- function is shared by many other tables' policies (leave_requests,
-- documents, marketing/sales RLS, etc.) where OPS_HR's broader access is
-- still intended. This adds a narrower, attendance-specific check instead.

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
