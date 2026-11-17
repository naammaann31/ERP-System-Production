-- ============================================================================
-- Fixes two real bugs in the sales_leads status-history trigger introduced
-- by migration 45, both reproduced live this session:
--
-- Bug 1 (FK violation on INSERT): stamp_sales_lead_status_updated_at() is a
-- BEFORE INSERT trigger that tried to INSERT a sales_lead_status_history row
-- referencing new.id as lead_id. Because it's a BEFORE trigger, the parent
-- row doesn't exist in sales_leads yet at that moment, so the child insert's
-- foreign key check fails every time a brand-new lead is imported/added with
-- a non-null initial status - exactly the error hit importing Honey's Lead
-- sheet. Fix: split the single BEFORE trigger into two - a BEFORE trigger
-- that only stamps new.status_updated_* fields (needs to stay BEFORE, since
-- only a BEFORE trigger can modify NEW), and a separate AFTER trigger that
-- does the sales_lead_status_history insert, once the row genuinely exists.
--
-- Bug 2 (NOT NULL violation on UPDATE): sales_lead_status_history.new_status
-- was declared `not null`, but a real, meaningful transition - moving a
-- lead's status back to "Not contacted" (status = null in the UI) - sets
-- new.status to null, which the trigger passed straight through, violating
-- the column's not-null constraint and blocking the save. "No status" is a
-- legitimate state (previous_status is already nullable for the same
-- reason), so the fix is to make new_status nullable too, not to special-
-- case around it.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention.
-- ============================================================================

alter table public.sales_lead_status_history
  alter column new_status drop not null;

-- BEFORE trigger: stamping only, no history insert.
create or replace function public.stamp_sales_lead_status_updated_at()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changed boolean;
  v_work_date date;
  v_attendance_id uuid;
begin
  if tg_op = 'INSERT' then
    v_changed := new.status is not null;
  else
    v_changed := new.status is distinct from old.status;
  end if;

  if v_changed then
    new.status_updated_at := now();
    select work_date, attendance_id into v_work_date, v_attendance_id
    from public.resolve_sales_status_work_context(auth.uid());
    new.status_updated_work_date := v_work_date;
    new.status_updated_attendance_id := v_attendance_id;
    new.status_updated_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.status_updated_at := old.status_updated_at;
    new.status_updated_work_date := old.status_updated_work_date;
    new.status_updated_attendance_id := old.status_updated_attendance_id;
    new.status_updated_by := old.status_updated_by;
  end if;

  return new;
end;
$$;

-- AFTER trigger: the row is guaranteed to exist in sales_leads by now, so
-- logging into sales_lead_status_history can never hit the FK violation.
-- Re-derives the same "did status change" condition independently (TG_OP/
-- OLD/NEW are available identically in an AFTER trigger) rather than
-- passing state between triggers, so this stays correct on its own.
create or replace function public.log_sales_lead_status_history()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_changed := new.status is not null;
  else
    v_changed := new.status is distinct from old.status;
  end if;

  if v_changed then
    insert into public.sales_lead_status_history (
      lead_id, previous_status, new_status, changed_by, changed_at,
      work_date, attendance_id, assigned_to_at_change
    ) values (
      new.id,
      case when tg_op = 'UPDATE' then old.status else null end,
      new.status,
      new.status_updated_by,
      new.status_updated_at,
      new.status_updated_work_date,
      new.status_updated_attendance_id,
      new.assigned_to
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sales_leads_log_status_history on public.sales_leads;
create trigger sales_leads_log_status_history
  after insert or update on public.sales_leads
  for each row execute function public.log_sales_lead_status_history();
