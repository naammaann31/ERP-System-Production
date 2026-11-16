-- ============================================================================
-- Sales module: track WHEN a lead was last assigned to someone, so the
-- "Sales Data" view can show newly-assigned leads at the top.
--
-- Problem this fixes: today, an employee's lead list sorts by entry_date
-- (the import date - identical for a whole batch) then created_at/id (also
-- from import time) - none of which reflect when a Team-Lead/Manager
-- actually handed a specific lead to a specific employee. Assigning leads
-- out of the unassigned queue in any order other than their original import
-- order therefore looked "random" to the employee receiving them.
--
-- assigned_at is stamped server-side, trigger-only (same pattern as
-- status_updated_at in migration 45) - a client can never set it directly,
-- it is always derived from whether assigned_to actually changed.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention.
-- ============================================================================

alter table public.sales_leads add column assigned_at timestamptz;

comment on column public.sales_leads.assigned_at is
  'Timestamp of the most recent assignment - set whenever assigned_to is newly set to a non-null value (including at import time, if assigned there). Cleared back to null when a lead is unassigned. Stamped only by stamp_sales_lead_assigned_at(), never settable directly by a client.';

-- Backfill: any row already assigned before this column existed gets
-- assigned_at = created_at, so pre-existing assignments don't all look
-- "never assigned" and sort to the bottom the moment this ships.
update public.sales_leads
  set assigned_at = created_at
  where assigned_to is not null and assigned_at is null;

create index sales_leads_assigned_at_idx on public.sales_leads(assigned_to, assigned_at desc nulls last);

create or replace function public.stamp_sales_lead_assigned_at()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is not null then
      new.assigned_at := now();
    end if;
  elsif new.assigned_to is distinct from old.assigned_to then
    new.assigned_at := case when new.assigned_to is null then null else now() end;
  else
    new.assigned_at := old.assigned_at;
  end if;
  return new;
end;
$$;

create trigger sales_leads_stamp_assigned_at
  before insert or update on public.sales_leads
  for each row execute function public.stamp_sales_lead_assigned_at();
