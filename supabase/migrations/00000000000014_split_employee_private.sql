-- ============================================================================
-- Move statutory / bank details out of `profiles`.
--
-- profiles_select is `using (true)` — every authenticated user can read every
-- profile row. RLS is ROW-level, so that grants access to every COLUMN of that
-- row too, including aadhar, pan, bank_account_name and bank_details. Verified
-- against the live project: a rank-and-file employee could read a colleague's
-- Aadhaar, PAN and bank account. The fields happen to be null today, so nothing
-- has leaked, but it would the moment HR filled them in.
--
-- A policy cannot hide a column, so the four fields move to a sibling table
-- whose own policy is "self, or Admin/HR" — the same rule the Documents page
-- already enforces in its UI, now enforced by the database.
--
-- profiles_select stays `using (true)`: names, emails and roles are directory
-- data the app legitimately shows everyone (assignee dropdowns, team widgets,
-- announcements). Only the sensitive columns are being partitioned off.
-- ============================================================================

create table public.employee_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  aadhar text,
  pan text,
  bank_account_name text,
  bank_details text,
  updated_at timestamptz not null default now()
);

comment on table public.employee_private is
  'Statutory and bank details. Readable only by the employee themselves and Admin/HR — deliberately NOT in profiles, which every authenticated user can read in full.';

-- Carry across whatever is already stored, then guarantee every existing
-- profile has a row so the UI never has to special-case a missing one.
insert into public.employee_private (id, aadhar, pan, bank_account_name, bank_details)
select id, aadhar, pan, bank_account_name, bank_details
from public.profiles
on conflict (id) do nothing;

-- Same guarantee for employees created from here on.
create or replace function public.create_employee_private()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.employee_private (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger profiles_create_private
  after insert on public.profiles
  for each row execute function public.create_employee_private();

create or replace function public.touch_employee_private()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger employee_private_touch
  before update on public.employee_private
  for each row execute function public.touch_employee_private();

-- ----------------------------------------------------------------------------
-- RLS — self or Admin/HR, matching the existing Documents page behaviour where
-- an employee maintains their own details and Admin/HR can do it on anyone's
-- behalf. No DELETE policy: rows disappear via the cascade when an employee is
-- deleted, which runs inside the SECURITY DEFINER delete_employee() RPC.
-- ----------------------------------------------------------------------------
alter table public.employee_private enable row level security;

create policy employee_private_select on public.employee_private
  for select to authenticated
  using (id = auth.uid() or public.is_admin_or_hr());

create policy employee_private_insert on public.employee_private
  for insert to authenticated
  with check (id = auth.uid() or public.is_admin_or_hr());

create policy employee_private_update on public.employee_private
  for update to authenticated
  using (id = auth.uid() or public.is_admin_or_hr())
  with check (id = auth.uid() or public.is_admin_or_hr());

-- ----------------------------------------------------------------------------
-- Drop the originals.
--
-- Safe with respect to the database's own code: protect_profile_fields() was
-- narrowed in migration 5 and no longer mentions these columns, and
-- delete_employee() only reads full_name. Both were checked before this ran.
-- ----------------------------------------------------------------------------
alter table public.profiles
  drop column aadhar,
  drop column pan,
  drop column bank_account_name,
  drop column bank_details;
