-- ============================================================================
-- New Sales module: sales_leads, sales_custom_columns, sales_daily_reports.
--
-- Replaces the old "Operations" sidebar tab (lib/operationsExcelImport.ts,
-- the `sales` table) going forward. The `sales` table itself is left
-- untouched — not dropped, not migrated — per explicit instruction: the UI
-- is being hidden, not deleted, until the new module is verified.
--
-- One physical table (sales_leads) backs two different UI views, mirroring
-- the already-proven candidates.assigned_to pattern instead of maintaining
-- two separate, sync-prone tables:
--   - "Master Data" tab: Sales Team-Lead/Manager + Admin/HR only. Shows every
--     row, assigned or not (assigned_to is null = sitting in the queue).
--   - "Sales Data" tab: every Sales employee sees only their own rows
--     (assigned_to = auth.uid()) via self-import or Team-Lead assignment.
--     Team-Lead/Manager/Admin/HR see every employee's rows in this same tab.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention,
-- only after review.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_sales_team_lead_or_manager() — same shape as is_marketing_team_lead()
-- (migration 12/15), for the SALES department's Team-Lead/Manager role.
-- ----------------------------------------------------------------------------
create or replace function public.is_sales_team_lead_or_manager()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() = 'SALES'
     and (
       public.current_designation() in ('Team-Lead', 'Manager')
       or public.current_job_role() in ('Team-Lead', 'Manager')
     );
$$;

-- ----------------------------------------------------------------------------
-- sales_leads
--
-- Two distinct date concepts, deliberately separate columns (not one
-- overloaded "date"):
--   - sourced_date: set once at creation (master import or self-import),
--     never changes afterward. What Master Data.xlsx's "Date" column is.
--   - status_updated_at: auto-stamped by a trigger below whenever `status`
--     changes. What the employee-facing "Date" column means - "variable,
--     changes with status-change recency."
-- ----------------------------------------------------------------------------
create table public.sales_leads (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  mobile text,
  email text,
  linkedin_url text,

  visa text,                 -- free text; "Others" selections are stored
                              -- here directly, no separate column
  status text check (status is null or status in (
    'Attempt 1', 'Attempt 2', 'Attempt 3', 'Follow up requested',
    'Interested', 'Not interested', 'Meeting scheduled', 'Closed', 'Dead Lead'
  )),
  country text,
  remarks text,

  sourced_date date not null default current_date,
  status_updated_at timestamptz,

  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),

  -- "Unnamed columns" — private-hybrid custom fields (see
  -- sales_custom_columns below for the per-owner column registry this
  -- keys off of).
  custom_fields jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

comment on table public.sales_leads is
  'Single source of truth for both the Sales "Master Data" (Team-Lead/Manager/Admin/HR) and "Sales Data" (per-employee) views. assigned_to = null means unassigned, sitting in the master queue.';

create index sales_leads_assigned_to_idx on public.sales_leads(assigned_to);
create index sales_leads_status_updated_at_idx on public.sales_leads(status_updated_at desc nulls last);
create index sales_leads_sourced_date_idx on public.sales_leads(sourced_date desc);
create index sales_leads_created_by_idx on public.sales_leads(created_by);

-- Stamp status_updated_at whenever status actually changes (or is set for
-- the first time on insert) - same mechanism as stamp_inactive_since
-- (migration 38).
create or replace function public.stamp_sales_lead_status_updated_at()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status is not null then
      new.status_updated_at := now();
    end if;
  elsif new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger sales_leads_stamp_status
  before insert or update on public.sales_leads
  for each row execute function public.stamp_sales_lead_status_updated_at();

-- Guard the fields a regular employee should never be able to change on
-- their own: who it's assigned to, who created it, and when it was
-- sourced. Same shape as protect_profile_fields() (migration 2/35).
create or replace function public.protect_sales_lead_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr()) then
    if new.assigned_to is distinct from old.assigned_to
      or new.created_by is distinct from old.created_by
      or new.sourced_date is distinct from old.sourced_date
    then
      raise exception 'Only Sales Team-Lead/Manager/Admin/HR can reassign a lead or change its source details.';
    end if;
  end if;
  return new;
end;
$$;

create trigger sales_leads_protect_fields
  before update on public.sales_leads
  for each row execute function public.protect_sales_lead_fields();

alter table public.sales_leads enable row level security;

create policy sales_leads_select on public.sales_leads
  for select to authenticated
  using (
    assigned_to = auth.uid()
    or public.is_sales_team_lead_or_manager()
    or public.is_admin_or_hr()
  );

-- A regular employee's self-import must assign the row to themselves;
-- Team-Lead/Manager/Admin/HR may insert with any assigned_to (including
-- null, for the unassigned master queue).
create policy sales_leads_insert on public.sales_leads
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      assigned_to = auth.uid()
      or public.is_sales_team_lead_or_manager()
      or public.is_admin_or_hr()
    )
  );

create policy sales_leads_update on public.sales_leads
  for update to authenticated
  using (
    assigned_to = auth.uid()
    or public.is_sales_team_lead_or_manager()
    or public.is_admin_or_hr()
  );

create policy sales_leads_delete on public.sales_leads
  for delete to authenticated
  using (
    public.is_sales_team_lead_or_manager()
    or public.is_admin_or_hr()
  );

-- ----------------------------------------------------------------------------
-- sales_leads_existing_identifiers() — lets a REGULAR employee's self-import
-- de-dup against the WHOLE table (every employee's leads), not just their
-- own, without ever exposing another employee's name/remarks/status/anything
-- else — RLS on sales_leads itself still fully restricts a regular employee
-- to their own rows for every normal query. This function returns nothing
-- but bare normalized phone/email identifiers, specifically so the import
-- flow can check "does this contact already exist anywhere" while staying
-- inside the data-isolation rule (user A never sees user B's actual lead
-- data). Team-Lead/Manager/Admin/HR don't need this - they already have
-- full SELECT access via the policy above and can de-dup with a normal
-- query.
-- ----------------------------------------------------------------------------
create or replace function public.sales_leads_existing_identifiers()
returns table(normalized_phone text, normalized_email text)
language sql stable security definer set search_path = public as $$
  select distinct
    nullif(
      case
        when length(regexp_replace(coalesce(mobile, ''), '\D', '', 'g')) = 11
             and regexp_replace(coalesce(mobile, ''), '\D', '', 'g') like '1%'
          then substr(regexp_replace(coalesce(mobile, ''), '\D', '', 'g'), 2)
        else regexp_replace(coalesce(mobile, ''), '\D', '', 'g')
      end,
      ''
    ) as normalized_phone,
    nullif(lower(trim(coalesce(email, ''))), '') as normalized_email
  from public.sales_leads
  where mobile is not null or email is not null;
$$;

grant execute on function public.sales_leads_existing_identifiers() to authenticated;

-- ----------------------------------------------------------------------------
-- sales_custom_columns — "private hybrid" custom column registry.
--
-- Only the owner (whoever defined the column) can create/rename/remove it.
-- Sales Team-Lead/Manager/Admin/HR can see every employee's custom columns
-- (needed to render the merged Master Data / full Sales Data views); no
-- other regular employee can see a column someone else defined, matching
-- the fact they can't see that employee's rows at all either.
-- ----------------------------------------------------------------------------
create table public.sales_custom_columns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  column_key text not null,     -- key used inside sales_leads.custom_fields
  column_label text not null,   -- display label as the owner typed it
  column_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, column_key)
);

alter table public.sales_custom_columns enable row level security;

create policy sales_custom_columns_select on public.sales_custom_columns
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_sales_team_lead_or_manager()
    or public.is_admin_or_hr()
  );

create policy sales_custom_columns_insert on public.sales_custom_columns
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy sales_custom_columns_update on public.sales_custom_columns
  for update to authenticated
  using (owner_id = auth.uid());

create policy sales_custom_columns_delete on public.sales_custom_columns
  for delete to authenticated
  using (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- sales_daily_reports — EOD report, one row per employee per shift.
--
-- window_start/window_end record the exact attendance clock-in/clock-out
-- bounds used to compute the counts below, for audit/debugging - the report
-- itself is a final-state snapshot (not a full status-change history) of
-- every lead whose status_updated_at fell inside that window, confirmed as
-- sufficient (vs. a full transition log) per explicit decision.
--
-- linkedin_requests_sent is the one manually-typed field; everything else
-- is computed client-side from sales_leads and only written here, never
-- read back from a privileged server action - this deliberately avoids the
-- unprotected-service-role-action pattern already flagged as a problem for
-- marketing_daily_reports (app/actions/marketing.ts). A regular INSERT
-- under normal RLS is all this needs.
-- ----------------------------------------------------------------------------
create table public.sales_daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  user_name text not null,
  report_date date not null,
  window_start timestamptz,
  window_end timestamptz,

  total_calls int not null default 0,
  new_calls int not null default 0,            -- Attempt 1
  churned_calls int not null default 0,        -- Attempt 2 + Attempt 3
  follow_up_requested int not null default 0,
  interested int not null default 0,
  not_interested int not null default 0,
  meeting_scheduled int not null default 0,
  closed int not null default 0,
  dead_lead int not null default 0,
  linkedin_requests_sent int not null default 0,

  created_at timestamptz not null default now()
);

create index sales_daily_reports_user_date_idx on public.sales_daily_reports(user_id, report_date desc);

alter table public.sales_daily_reports enable row level security;

create policy sales_daily_reports_select on public.sales_daily_reports
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_sales_team_lead_or_manager()
    or public.is_admin_or_hr()
  );

create policy sales_daily_reports_insert on public.sales_daily_reports
  for insert to authenticated
  with check (user_id = auth.uid());

-- Reports are immutable once submitted by the employee; only Team-Lead/
-- Manager/Admin/HR may correct or remove one.
create policy sales_daily_reports_update on public.sales_daily_reports
  for update to authenticated
  using (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr());

create policy sales_daily_reports_delete on public.sales_daily_reports
  for delete to authenticated
  using (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr());
