-- ============================================================================
-- Marketing Candidates.
--
-- A Team-Lead adds candidates and assigns each one to a marketing employee.
-- That employee sees only the candidates assigned to them; no other employee
-- can see them.
--
-- The boundary is enforced in RLS, not in the UI — the same mistake the
-- original marketing_select policy made (see migration 7) was relying on
-- client-side filtering, which any user could bypass by calling PostgREST
-- directly.
--
--   assignee   -> only rows where assigned_to = their uid, read-only
--   Team-Lead  -> all rows, full write access
--   Admin/HR   -> all rows, full write access (consistent with every other
--                 module in the app)
-- ============================================================================

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  -- `position` is a Postgres col_name_keyword, so avoid it entirely.
  job_title text,
  source text,
  status text not null default 'New'
    check (status in ('New', 'Contacted', 'Interviewing', 'Selected', 'Rejected', 'On Hold')),
  notes text not null default '',
  assigned_to uuid references public.profiles(id) on delete set null,
  -- Denormalised for display, matching created_by_name on marketing and
  -- interview_screening_entries. assigned_to stays authoritative for RLS.
  assigned_to_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.candidates is
  'Marketing candidates. Assigned by a Team-Lead to one marketing employee, who is the only non-manager able to see the row.';

create index candidates_assigned_to_idx on public.candidates(assigned_to);
create index candidates_created_at_idx on public.candidates(created_at desc);

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

create or replace function public.current_job_role()
returns text
language sql stable security definer set search_path = public as $$
  select job_role from public.profiles where id = auth.uid();
$$;

-- Mirrors how the app itself decides who is a Team-Lead (see Sidebar.tsx and
-- ProtectedRoute.tsx, which both accept designation OR job_role). Keeping the
-- database in step with the UI avoids a lead who can see the nav item but
-- gets an empty table.
create or replace function public.is_marketing_team_lead()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() = 'MARKETING'
     and (public.current_designation() = 'Team-Lead' or public.current_job_role() = 'Team-Lead');
$$;

-- ----------------------------------------------------------------------------
-- Ownership / timestamps
--
-- created_by is stamped server-side rather than trusted from the client: a
-- client that sends null produces `null = auth.uid()` -> NULL, which fails the
-- policy check and surfaces as a bare 42501. Same fix as migration 10.
-- ----------------------------------------------------------------------------

create or replace function public.set_candidate_owner()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger candidates_set_owner
  before insert on public.candidates
  for each row execute function public.set_candidate_owner();

create or replace function public.touch_candidate()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger candidates_touch
  before update on public.candidates
  for each row execute function public.touch_candidate();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.candidates enable row level security;

create policy candidates_select on public.candidates
  for select to authenticated
  using (
    assigned_to = auth.uid()
    or public.is_admin_or_hr()
    or public.is_marketing_team_lead()
  );

-- Employees are deliberately read-only: they see their assigned candidates
-- but cannot create, reassign, or remove them.
create policy candidates_insert on public.candidates
  for insert to authenticated
  with check (public.is_admin_or_hr() or public.is_marketing_team_lead());

create policy candidates_update on public.candidates
  for update to authenticated
  using (public.is_admin_or_hr() or public.is_marketing_team_lead())
  with check (public.is_admin_or_hr() or public.is_marketing_team_lead());

create policy candidates_delete on public.candidates
  for delete to authenticated
  using (public.is_admin_or_hr() or public.is_marketing_team_lead());

-- ----------------------------------------------------------------------------
-- Realtime — without publication membership every postgres_changes
-- subscription on this table is silently inert (see migration 11).
-- ----------------------------------------------------------------------------
alter table public.candidates replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'candidates'
  ) then
    alter publication supabase_realtime add table public.candidates;
  end if;
end $$;
