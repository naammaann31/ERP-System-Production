-- ============================================================================
-- Vectra ERP — Initial Postgres schema (migrated from Firestore)
-- DRAFT FOR REVIEW — not yet applied to the remote project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- Replaces Firestore "users" + legacy "Users" collections.
-- One row per auth.users row (Supabase Auth), created via trigger on signup.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'Employee',
  status text not null default 'Active',
  job_role text,
  employee_id text,
  designation text,
  department text,
  phone text,
  timezone text default 'Asia/Kolkata',
  notifications_email boolean not null default true,
  notifications_leave boolean not null default true,
  notifications_payroll boolean not null default true,
  aadhar text,
  pan text,
  bank_account_name text,
  bank_details text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Employee/user profile data. role also carries department tags (MARKETING/SALES/IT/OPS_HR) matching legacy Firestore behavior.';

-- ----------------------------------------------------------------------------
-- attendance
-- Replaces Firestore "attendance" (doc id was `${userId}_${date}`).
-- ----------------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text,
  role text,
  date date not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text not null default 'Checked In'
    check (status in ('Present', 'Checked In', 'Absent', 'On Leave', 'Week Off')),
  working_seconds integer not null default 0,
  unique (user_id, date)
);

create index attendance_date_idx on public.attendance(date);
create index attendance_user_idx on public.attendance(user_id);

-- ----------------------------------------------------------------------------
-- leave_requests
-- ----------------------------------------------------------------------------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text,
  department text,
  role text,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days numeric not null,
  reason text,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Rejected')),
  applied_on timestamptz not null default now()
);

create index leave_requests_user_idx on public.leave_requests(user_id);
create index leave_requests_status_idx on public.leave_requests(status);

-- ----------------------------------------------------------------------------
-- salary_structures
-- One row per employee (was Firestore doc id = userId).
-- ----------------------------------------------------------------------------
create table public.salary_structures (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  gross_salary numeric not null default 0,
  travel_allowance numeric not null default 0,
  other_deductions numeric not null default 0,
  other_allowances numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- payrolls
-- Replaces Firestore "payrolls" (doc id was `${userId}_${year}_${month}`).
-- Written only via a privileged RPC (see migration 3), matching the old
-- Cloud Function-only write path.
-- ----------------------------------------------------------------------------
create table public.payrolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  employee_name text,
  employee_id text,
  job_role text,
  department text,
  date_of_joining date,
  bank_name text,
  division text,
  days_worked integer,
  month integer not null check (month between 1 and 12),
  year integer not null,

  gross_salary numeric not null default 0,
  basic numeric not null default 0,
  hra numeric not null default 0,
  travel_allowance numeric not null default 0,
  special_allowance numeric not null default 0,
  other_allowances numeric not null default 0,
  incentives numeric not null default 0,

  total_earnings numeric not null default 0,

  lop_days numeric not null default 0,
  lop_deduction numeric not null default 0,
  tax_deduction numeric not null default 0,
  income_tax numeric not null default 0,
  provident_fund numeric not null default 0,
  other_deductions numeric not null default 0,

  total_deductions numeric not null default 0,
  net_salary numeric not null default 0,

  payment_date date,
  mode_of_payment text,

  generated_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Paid', 'Pending')),

  unique (user_id, year, month)
);

create index payrolls_user_idx on public.payrolls(user_id);

-- ----------------------------------------------------------------------------
-- announcements
-- ----------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  author uuid references public.profiles(id) on delete set null,
  author_name text,
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- documents
-- Metadata table; actual files live in Supabase Storage bucket "documents".
-- ----------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  size text,
  status text not null default 'Pending Review'
    check (status in ('Verified', 'Available', 'Pending Review')),
  scope text not null check (scope in ('personal', 'company')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now(),
  storage_url text,
  storage_path text not null
);

create index documents_uploaded_by_idx on public.documents(uploaded_by);

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  type text not null default 'general'
    check (type in ('payroll', 'leave', 'announcement', 'general')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id);

-- ----------------------------------------------------------------------------
-- audit_logs
-- Written only via privileged RPCs (see migration 3).
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_name text,
  actor_uid uuid references public.profiles(id) on delete set null,
  action text not null,
  target text,
  details text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- ----------------------------------------------------------------------------
-- sales
-- Replaces Firestore "sales" (schemaless spreadsheet-column documents).
-- created_by added (was missing) to support real ownership-based RLS.
-- ----------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  date date,
  candidate_name text,
  contact_number text,
  email text,
  visa_status text,
  job_role text,
  experience text,
  location text,
  internal_name text,
  linkedin_url text,
  feedback text,
  status text not null default 'New',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index sales_created_by_idx on public.sales(created_by);
create index sales_date_idx on public.sales(date);

-- ----------------------------------------------------------------------------
-- marketing
-- Replaces Firestore "marketing" (schemaless spreadsheet-column documents).
-- ----------------------------------------------------------------------------
create table public.marketing (
  id uuid primary key default gen_random_uuid(),
  candidate_name text,
  date date,
  company_name text,
  link text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index marketing_created_by_idx on public.marketing(created_by);
create index marketing_date_idx on public.marketing(date);
