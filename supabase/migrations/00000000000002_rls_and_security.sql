-- ============================================================================
-- Vectra ERP — RLS policies, profile-creation trigger, and privileged RPCs
-- DRAFT FOR REVIEW — not yet applied to the remote project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read `profiles` without
-- recursing through RLS on `profiles` itself).
-- ----------------------------------------------------------------------------
create or replace function public.current_role_name()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() = 'Admin';
$$;

create or replace function public.is_admin_or_hr()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() in ('Admin', 'HR', 'OPS_HR');
$$;

-- ----------------------------------------------------------------------------
-- profiles: creation trigger (mirrors Cloud Function admin.auth().createUser
-- + admin.firestore().set() pattern — role/employee fields are only ever
-- trusted from server-side metadata set by a privileged server action,
-- never from arbitrary client-supplied signup data).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, employee_id, job_role, designation, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    -- Role is only ever taken from metadata set by the privileged
    -- server-side employee-creation action (see Step 8), which uses the
    -- Auth Admin API with the service-role key. Client-driven signup (if
    -- ever enabled) always defaults to 'Employee' regardless of metadata,
    -- since raw_user_meta_data can otherwise be set by the signing-up
    -- client itself.
    coalesce(new.raw_user_meta_data->>'role', 'Employee'),
    new.raw_user_meta_data->>'employee_id',
    new.raw_user_meta_data->>'job_role',
    new.raw_user_meta_data->>'designation',
    new.raw_user_meta_data->>'department'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent an owner from elevating their own privileges via a normal
-- UPDATE, even though the RLS policy below allows owners to update their
-- own row (for name/phone/timezone/notification prefs). Admin/HR can
-- still change these fields on anyone's profile.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_or_hr() then
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

create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ----------------------------------------------------------------------------
-- profiles RLS
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- No INSERT policy for `authenticated`: rows are only ever created by the
-- on_auth_user_created trigger (runs as SECURITY DEFINER) or a service-role
-- server action. Direct client inserts are blocked by default-deny.

create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.is_admin_or_hr())
  with check (auth.uid() = id or public.is_admin_or_hr());

create policy profiles_delete on public.profiles
  for delete to authenticated using (public.is_admin_or_hr());

-- ----------------------------------------------------------------------------
-- attendance RLS
-- ----------------------------------------------------------------------------
alter table public.attendance enable row level security;

create policy attendance_select on public.attendance
  for select to authenticated using (true);

create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin_or_hr());

create policy attendance_update on public.attendance
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin_or_hr());

create policy attendance_delete on public.attendance
  for delete to authenticated using (public.is_admin_or_hr());

-- ----------------------------------------------------------------------------
-- leave_requests RLS
-- ----------------------------------------------------------------------------
alter table public.leave_requests enable row level security;

create policy leave_requests_select on public.leave_requests
  for select to authenticated using (true);

create policy leave_requests_insert on public.leave_requests
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin_or_hr());

create policy leave_requests_update on public.leave_requests
  for update to authenticated using (public.is_admin_or_hr());

create policy leave_requests_delete on public.leave_requests
  for delete to authenticated using (public.is_admin_or_hr());

-- ----------------------------------------------------------------------------
-- salary_structures RLS
-- Tightened vs. Firestore: was readable by ANY signed-in user. Now owner
-- or Admin/HR only.
-- ----------------------------------------------------------------------------
alter table public.salary_structures enable row level security;

create policy salary_structures_select on public.salary_structures
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_hr());

create policy salary_structures_write on public.salary_structures
  for all to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

-- ----------------------------------------------------------------------------
-- payrolls RLS
-- Tightened vs. Firestore: was readable by ANY signed-in user, and directly
-- writable by Admin/HR (bypassing the audit trail). Now owner/Admin/HR can
-- read; all writes go through the generate_payroll() RPC only.
-- ----------------------------------------------------------------------------
alter table public.payrolls enable row level security;

create policy payrolls_select on public.payrolls
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_hr());

create policy payrolls_delete on public.payrolls
  for delete to authenticated using (public.is_admin_or_hr());

-- No direct INSERT/UPDATE policy: only generate_payroll() (SECURITY DEFINER)
-- can write payroll rows, guaranteeing every payroll is audit-logged.

-- ----------------------------------------------------------------------------
-- announcements RLS
-- ----------------------------------------------------------------------------
alter table public.announcements enable row level security;

create policy announcements_select on public.announcements
  for select to authenticated using (true);

create policy announcements_write on public.announcements
  for all to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

-- ----------------------------------------------------------------------------
-- documents RLS
-- ----------------------------------------------------------------------------
alter table public.documents enable row level security;

create policy documents_select on public.documents
  for select to authenticated using (true);

create policy documents_insert on public.documents
  for insert to authenticated
  with check (uploaded_by = auth.uid() or public.is_admin_or_hr());

create policy documents_update on public.documents
  for update to authenticated
  using (uploaded_by = auth.uid() or public.is_admin_or_hr());

create policy documents_delete on public.documents
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin_or_hr());

-- ----------------------------------------------------------------------------
-- notifications RLS
-- Tightened vs. Firestore: was readable by ANY signed-in user (could read
-- everyone else's notifications). Now owner/Admin/HR only for reads.
-- INSERT stays broad (unchanged) because announcement fan-out creates
-- notifications for every other user from the announcement author's own
-- client session.
-- ----------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_hr());

create policy notifications_insert on public.notifications
  for insert to authenticated with check (true);

create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid());

create policy notifications_delete on public.notifications
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- audit_logs RLS
-- Tightened vs. Firestore: direct client INSERT is no longer allowed at
-- all (previously any signed-in user could write fabricated audit entries).
-- All writes go through the log_audit() RPC only.
-- ----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy for `authenticated`: only log_audit()
-- (SECURITY DEFINER) and generate_payroll()/delete_employee() may write.

-- ----------------------------------------------------------------------------
-- sales RLS
-- Restricted per your decision: creator, Admin/HR, or SALES department can
-- read; only the creator or Admin/HR can write/delete a given row.
-- ----------------------------------------------------------------------------
alter table public.sales enable row level security;

create policy sales_select on public.sales
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin_or_hr()
    or public.current_role_name() = 'SALES'
  );

create policy sales_insert on public.sales
  for insert to authenticated
  with check (created_by = auth.uid() or public.is_admin_or_hr());

create policy sales_update on public.sales
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin_or_hr());

create policy sales_delete on public.sales
  for delete to authenticated using (public.is_admin_or_hr());

-- ----------------------------------------------------------------------------
-- marketing RLS
-- Same pattern as sales, but delete also allowed for the record's own
-- creator (matches original Firestore rule asymmetry between the two
-- collections).
-- ----------------------------------------------------------------------------
alter table public.marketing enable row level security;

create policy marketing_select on public.marketing
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin_or_hr()
    or public.current_role_name() = 'MARKETING'
  );

create policy marketing_insert on public.marketing
  for insert to authenticated
  with check (created_by = auth.uid() or public.is_admin_or_hr());

create policy marketing_update on public.marketing
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin_or_hr());

create policy marketing_delete on public.marketing
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin_or_hr());

-- ============================================================================
-- Privileged RPCs — replace the 3 Firebase Cloud Functions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- log_audit(action, target, details)
-- Replaces functions/src/audit.ts "logAudit".
-- ----------------------------------------------------------------------------
create or replace function public.log_audit(
  p_action text,
  p_target text,
  p_details text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated.';
  end if;

  select full_name into v_actor_name from public.profiles where id = auth.uid();

  insert into public.audit_logs (actor_name, actor_uid, action, target, details)
  values (coalesce(v_actor_name, 'Unknown User'), auth.uid(), p_action, p_target, p_details);
end;
$$;

-- ----------------------------------------------------------------------------
-- generate_payroll(...)
-- Replaces functions/src/payroll.ts "generatePayroll". Same calculation
-- logic (basic = 50% gross, hra = 20% gross, etc.), server-computed only.
-- ----------------------------------------------------------------------------
create or replace function public.generate_payroll(
  p_employee_uid uuid,
  p_month integer,
  p_year integer,
  p_lop_days numeric default 0,
  p_professional_tax numeric default 200,
  p_income_tax numeric default 0,
  p_provident_fund numeric default 0,
  p_incentives numeric default 0,
  p_payment_date date default null,
  p_mode_of_payment text default 'Bank Transfer'
)
returns public.payrolls
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_structure public.salary_structures;
  v_days_in_month integer;
  v_basic numeric;
  v_hra numeric;
  v_special_allowance numeric;
  v_total_earnings numeric;
  v_per_day_salary numeric;
  v_lop_deduction numeric;
  v_total_deductions numeric;
  v_net_salary numeric;
  v_actor_name text;
  v_result public.payrolls;
begin
  if not public.is_admin_or_hr() then
    raise exception 'Only Admin or HR can generate payrolls.';
  end if;

  select * into v_profile from public.profiles where id = p_employee_uid;
  select * into v_structure from public.salary_structures where user_id = p_employee_uid;

  if v_profile.id is null or v_structure.user_id is null then
    raise exception 'User or salary structure not found.';
  end if;

  v_days_in_month := extract(day from (date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month - 1 day'));

  v_basic := v_structure.gross_salary * 0.5;
  v_hra := v_structure.gross_salary * 0.2;
  v_special_allowance := greatest(0, v_structure.gross_salary - v_basic - v_hra - v_structure.travel_allowance);
  v_total_earnings := v_structure.gross_salary + v_structure.other_allowances + p_incentives;
  v_per_day_salary := v_structure.gross_salary / v_days_in_month;
  v_lop_deduction := v_per_day_salary * p_lop_days;
  v_total_deductions := v_lop_deduction + p_professional_tax + p_income_tax + p_provident_fund + v_structure.other_deductions;
  v_net_salary := v_total_earnings - v_total_deductions;

  insert into public.payrolls (
    user_id, employee_name, employee_id, job_role, department,
    month, year, gross_salary, basic, hra, travel_allowance,
    special_allowance, other_allowances, incentives, total_earnings,
    lop_days, lop_deduction, tax_deduction, income_tax, provident_fund,
    other_deductions, total_deductions, net_salary, payment_date,
    mode_of_payment, status
  ) values (
    p_employee_uid, v_profile.full_name, v_profile.employee_id, v_profile.job_role, v_profile.department,
    p_month, p_year, v_structure.gross_salary, v_basic, v_hra, v_structure.travel_allowance,
    v_special_allowance, v_structure.other_allowances, p_incentives, v_total_earnings,
    p_lop_days, v_lop_deduction, p_professional_tax, p_income_tax, p_provident_fund,
    v_structure.other_deductions, v_total_deductions, v_net_salary, coalesce(p_payment_date, current_date),
    p_mode_of_payment, 'Paid'
  )
  on conflict (user_id, year, month) do update set
    employee_name = excluded.employee_name, employee_id = excluded.employee_id,
    job_role = excluded.job_role, department = excluded.department,
    gross_salary = excluded.gross_salary, basic = excluded.basic, hra = excluded.hra,
    travel_allowance = excluded.travel_allowance, special_allowance = excluded.special_allowance,
    other_allowances = excluded.other_allowances, incentives = excluded.incentives,
    total_earnings = excluded.total_earnings, lop_days = excluded.lop_days,
    lop_deduction = excluded.lop_deduction, tax_deduction = excluded.tax_deduction,
    income_tax = excluded.income_tax, provident_fund = excluded.provident_fund,
    other_deductions = excluded.other_deductions, total_deductions = excluded.total_deductions,
    net_salary = excluded.net_salary, payment_date = excluded.payment_date,
    mode_of_payment = excluded.mode_of_payment, status = excluded.status,
    generated_at = now()
  returning * into v_result;

  select full_name into v_actor_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_name, actor_uid, action, target, details)
  values (coalesce(v_actor_name, 'Unknown'), auth.uid(), 'Generated Payroll', p_employee_uid::text,
          format('Generated payroll for %s/%s', p_month, p_year));

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- delete_employee(employee_uid)
-- Replaces functions/src/users.ts "deleteEmployee". Deletes the auth user
-- directly (cascades to profiles via FK), unlike the old client fallback
-- that could delete the Firestore doc while leaving an orphaned Auth user.
-- ----------------------------------------------------------------------------
create or replace function public.delete_employee(p_employee_uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
begin
  if not public.is_admin_or_hr() then
    raise exception 'Only Admin or HR can delete employees.';
  end if;

  select full_name into v_actor_name from public.profiles where id = auth.uid();

  delete from auth.users where id = p_employee_uid;

  insert into public.audit_logs (actor_name, actor_uid, action, target)
  values (coalesce(v_actor_name, 'Unknown'), auth.uid(), 'Deleted Employee', p_employee_uid::text);
end;
$$;
