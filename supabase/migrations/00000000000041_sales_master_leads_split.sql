-- ============================================================================
-- Splits Master Data into its own table, separate from sales_leads.
--
-- Reverses the original one-table-two-views design for this specific case,
-- per explicit instruction after testing: Master Data should be a pure
-- raw-import + assignment queue, completely separate from sales_leads
-- (which now holds ONLY rows that are actually assigned and being worked
-- by an employee). A row is copied from sales_master_leads into sales_leads
-- the moment it gets assigned - at import time (if the sheet's "Assigned
-- To" already resolved to a real employee) or later via the Team-Lead's
-- manual assign action. Reassigning an already-pushed row updates that
-- existing sales_leads row's assigned_to rather than creating a duplicate -
-- pushed_lead_id is the 1:1 pointer that makes that possible.
--
-- sales_master_leads is Team-Lead/Manager/Admin/HR only - a regular
-- employee has no access to it at all, matching the original spec exactly
-- ("this table's access will be to only sales team lead or sales manager
-- not normal sales employee").
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention,
-- only after review.
-- ============================================================================

create table public.sales_master_leads (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  mobile text,
  email text,
  linkedin_url text,

  sourced_date date not null default current_date,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),

  custom_fields jsonb not null default '{}'::jsonb,

  -- Points at the sales_leads row this master row was copied into, once
  -- assigned. Null until assignment happens. Reassigning an already-pushed
  -- row updates sales_leads.assigned_to on this same linked row instead of
  -- inserting a second copy.
  pushed_lead_id uuid references public.sales_leads(id) on delete set null,

  created_at timestamptz not null default now()
);

create index sales_master_leads_assigned_to_idx on public.sales_master_leads(assigned_to);
create index sales_master_leads_sourced_date_idx on public.sales_master_leads(sourced_date desc);

alter table public.sales_master_leads enable row level security;

create policy sales_master_leads_select on public.sales_master_leads
  for select to authenticated
  using (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr());

create policy sales_master_leads_insert on public.sales_master_leads
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr())
  );

create policy sales_master_leads_update on public.sales_master_leads
  for update to authenticated
  using (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr());

create policy sales_master_leads_delete on public.sales_master_leads
  for delete to authenticated
  using (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr());

-- Traceability back from the worked copy to where it came from.
alter table public.sales_leads add column if not exists master_lead_id uuid references public.sales_master_leads(id) on delete set null;
create index if not exists sales_leads_master_lead_id_idx on public.sales_leads(master_lead_id);

-- ----------------------------------------------------------------------------
-- sales_leads_existing_identifiers() must now cover BOTH tables, so a
-- regular employee's self-import also de-dups against leads still sitting
-- unassigned in the master queue (not yet copied into sales_leads at all),
-- not just already-assigned ones.
-- ----------------------------------------------------------------------------
create or replace function public.sales_leads_existing_identifiers()
returns table(normalized_phone text, normalized_email text)
language sql stable security definer set search_path = public as $$
  select
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
  where mobile is not null or email is not null
  union
  select
    nullif(
      case
        when length(regexp_replace(coalesce(mobile, ''), '\D', '', 'g')) = 11
             and regexp_replace(coalesce(mobile, ''), '\D', '', 'g') like '1%'
          then substr(regexp_replace(coalesce(mobile, ''), '\D', '', 'g'), 2)
        else regexp_replace(coalesce(mobile, ''), '\D', '', 'g')
      end,
      ''
    ),
    nullif(lower(trim(coalesce(email, ''))), '')
  from public.sales_master_leads
  where mobile is not null or email is not null;
$$;

-- ----------------------------------------------------------------------------
-- sales_master_leads_set_pushed() — batches the "link this master row to
-- the sales_leads copy just created for it" write for an entire import in
-- one round trip, instead of one UPDATE per assigned row (a 3,000-row
-- import can have 2,000+ newly-assigned rows; looping individual updates
-- client-side would be 2,000+ sequential requests). No SECURITY DEFINER -
-- the caller still needs sales_master_leads_update's own RLS check
-- (Team-Lead/Manager/Admin/HR) to succeed, this just batches the writes.
-- ----------------------------------------------------------------------------
create or replace function public.sales_master_leads_set_pushed(p_master_ids uuid[], p_lead_ids uuid[])
returns void
language sql set search_path = public as $$
  update public.sales_master_leads m
  set pushed_lead_id = v.lead_id
  from (select unnest(p_master_ids) as master_id, unnest(p_lead_ids) as lead_id) v
  where m.id = v.master_id;
$$;

grant execute on function public.sales_master_leads_set_pushed(uuid[], uuid[]) to authenticated;
