-- ============================================================================
-- Sales module: collapse back to a single canonical table, add the
-- entry-date / status-work-date / status-history / import-batch machinery.
--
-- Context: migration 40 originally designed sales_leads as the single
-- source of truth; migration 41 split off sales_master_leads as a separate
-- queue table after testing. This migration reverses that split — per
-- explicit instruction, confirmed against a live check that both tables are
-- currently EMPTY (intentionally cleared before this rebuild), so this is a
-- schema change with no production data to migrate, not a data migration.
--
-- Business rules this enforces (final, non-negotiable, per instruction):
--   - ONE row = one lead entry, never one row per unique candidate. No
--     candidate-level dedup constraint exists anywhere in this schema.
--   - entry_date (renamed from sourced_date) never changes after creation.
--   - status_updated_at = the real transition timestamp (unchanged from
--     migration 42's fix - UPDATE only, status must actually change).
--   - status_updated_work_date = the IST calendar date of the EDITOR's own
--     attendance shift at the moment of the change (NOT the raw timestamp's
--     date) - see resolve_sales_status_work_context() below.
--   - status_updated_attendance_id / status_updated_by record which
--     attendance record and which user actually made the change.
--   - sales_lead_status_history preserves every transition permanently;
--     sales_leads itself still only carries the latest status.
--   - Regular Sales employees can no longer create ANY new sales_leads row
--     (no self-import, no manual add) - only Admin/HR/Sales Team-Lead/Sales
--     Manager may insert. This is strictly narrower than is_admin_or_hr(),
--     which also covers OPS_HR - OPS_HR is deliberately NOT given import
--     rights here, per explicit instruction not to broaden unrelated roles.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention,
-- only after review.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_sales_import_authorized() — Admin, HR, Sales Team-Lead, Sales Manager.
-- Deliberately narrower than is_admin_or_hr() (which also covers OPS_HR):
-- OPS_HR keeps every other existing Sales permission it already had via
-- is_admin_or_hr() in the select/update/delete policies below (unchanged),
-- it simply isn't added to the one new, explicitly-scoped import/creation
-- restriction. Defined up front since sales_import_batches' own INSERT
-- policy (right below) needs it immediately.
-- ----------------------------------------------------------------------------
create or replace function public.is_sales_import_authorized()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() in ('Admin', 'HR')
     or public.is_sales_team_lead_or_manager();
$$;

-- ----------------------------------------------------------------------------
-- sales_import_batches — one row per upload. Exists purely so a retried
-- upload of the same file can be told apart from a genuinely new one; see
-- the unique index on sales_leads(source_batch_id, source_sheet,
-- source_row_number) below, which is the actual idempotency enforcement.
-- ----------------------------------------------------------------------------
create table public.sales_import_batches (
  id uuid primary key default gen_random_uuid(),
  imported_by uuid not null references public.profiles(id),
  source_file text,
  imported_at timestamptz not null default now(),
  import_mode text not null default 'new_leads',
  source_row_count int not null default 0,
  successful_row_count int not null default 0,
  failed_row_count int not null default 0
);

alter table public.sales_import_batches enable row level security;

create policy sales_import_batches_select on public.sales_import_batches
  for select to authenticated
  using (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr());

create policy sales_import_batches_insert on public.sales_import_batches
  for insert to authenticated
  with check (imported_by = auth.uid() and public.is_sales_import_authorized());

-- ----------------------------------------------------------------------------
-- sales_leads: rename sourced_date -> entry_date (same semantics, clearer
-- name now that a second, different "date" concept exists on this table),
-- drop the Master-split-era master_lead_id column, add the new
-- attendance-linked status-tracking columns and import-batch columns.
-- ----------------------------------------------------------------------------
alter table public.sales_leads rename column sourced_date to entry_date;

alter table public.sales_leads
  add column status_updated_work_date date,
  add column status_updated_attendance_id uuid references public.attendance(id) on delete set null,
  add column status_updated_by uuid references public.profiles(id) on delete set null,
  add column source_batch_id uuid references public.sales_import_batches(id) on delete set null,
  add column source_sheet text,
  add column source_row_number int;

comment on column public.sales_leads.entry_date is
  'The date associated with this specific lead entry (exact Excel date, or current IST date for a manual/no-date row). Set once, never changes afterward - including when status changes.';
comment on column public.sales_leads.status_updated_work_date is
  'The IST calendar date of the attendance shift the editor was on when status last changed - NOT the raw status_updated_at timestamp''s own date. See resolve_sales_status_work_context().';

-- The old Master/Sales split is gone: drop sales_master_leads (cascade
-- removes the FK constraint sales_leads.master_lead_id pointed at it), then
-- drop the now-pointless column, and the RPCs that only existed to support
-- the two-table push/link/dedup dance.
drop table if exists public.sales_master_leads cascade;
alter table public.sales_leads drop column if exists master_lead_id;
drop function if exists public.sales_master_leads_set_pushed(uuid[], uuid[]);
drop function if exists public.sales_leads_existing_identifiers();

-- ----------------------------------------------------------------------------
-- sales_lead_status_history — every genuine status transition, permanently.
-- sales_leads.status/status_updated_at/etc. only ever carry the LATEST
-- state; this table is the only place earlier transitions survive.
-- assigned_to_at_change is captured so a later reassignment doesn't retroactively
-- change who a past transition "belonged to" for history-reading purposes.
-- ----------------------------------------------------------------------------
create table public.sales_lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  work_date date,
  attendance_id uuid references public.attendance(id) on delete set null,
  assigned_to_at_change uuid references public.profiles(id) on delete set null,
  change_source text not null default 'portal',
  created_at timestamptz not null default now()
);

create index sales_lead_status_history_lead_id_idx on public.sales_lead_status_history(lead_id);
create index sales_lead_status_history_attendance_id_idx on public.sales_lead_status_history(attendance_id);
create index sales_lead_status_history_work_date_idx on public.sales_lead_status_history(work_date);
create index sales_lead_status_history_changed_by_idx on public.sales_lead_status_history(changed_by);
create index sales_lead_status_history_changed_at_idx on public.sales_lead_status_history(changed_at desc);

alter table public.sales_lead_status_history enable row level security;

-- Written only by the trigger below (SECURITY DEFINER, runs as the table
-- owner, bypasses RLS) - no INSERT/UPDATE/DELETE policy is granted to
-- `authenticated` at all, matching audit_logs' existing write-only-via-RPC
-- pattern elsewhere in this project. Read access: the employee who owned
-- the lead at the moment of that specific change, or management.
create policy sales_lead_status_history_select on public.sales_lead_status_history
  for select to authenticated
  using (
    assigned_to_at_change = auth.uid()
    or public.is_sales_team_lead_or_manager()
    or public.is_admin_or_hr()
  );

-- ----------------------------------------------------------------------------
-- resolve_sales_status_work_context(p_user_id) — the actual "which
-- attendance shift is this status change happening during" logic.
--
-- Deliberately mirrors getTodayAttendance()/getLocalDateString() in
-- lib/attendance.ts exactly (same two rules: an open "Checked In" row wins
-- regardless of its own date, so a post-midnight edit still belongs to the
-- shift that's still open; otherwise only a row dated today counts) rather
-- than re-deriving a date from check_in_time's own timestamp - attendance.date
-- already has the correct shift-boundary rule baked in (including the
-- hour<6 night-shift rollback), so reusing it is more correct than
-- recomputing it from a raw timestamp would be.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_sales_status_work_context(p_user_id uuid)
returns table(work_date date, attendance_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_ist_hour int;
  v_today_ist date;
  v_att_id uuid;
  v_att_date date;
  v_att_status text;
begin
  v_ist_hour := extract(hour from (v_now at time zone 'Asia/Kolkata'))::int;
  if v_ist_hour < 6 then
    v_today_ist := ((v_now - interval '6 hours') at time zone 'Asia/Kolkata')::date;
  else
    v_today_ist := (v_now at time zone 'Asia/Kolkata')::date;
  end if;

  select a.id, a.date, a.status into v_att_id, v_att_date, v_att_status
  from public.attendance a
  where a.user_id = p_user_id
  order by a.date desc
  limit 1;

  if v_att_status = 'Checked In' then
    return query select v_att_date, v_att_id;
  elsif v_att_date = v_today_ist then
    return query select v_att_date, v_att_id;
  else
    -- No attendance record covers this moment - caller falls back to
    -- today's IST date with no attendance_id, and the caller is
    -- responsible for treating that as "not attendance-linked".
    return query select v_today_ist, null::uuid;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Rewritten status trigger: on a genuine status change (or initial non-null
-- status at insert), stamps status_updated_at/work_date/attendance_id/by and
-- inserts one history row. On any other update, forces these four columns
-- back to their OLD values - a client can never set them directly, only
-- this trigger ever writes them, and only when status itself changed.
-- ----------------------------------------------------------------------------
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

    insert into public.sales_lead_status_history (
      lead_id, previous_status, new_status, changed_by, changed_at,
      work_date, attendance_id, assigned_to_at_change
    ) values (
      new.id,
      case when tg_op = 'UPDATE' then old.status else null end,
      new.status,
      auth.uid(),
      new.status_updated_at,
      v_work_date,
      v_attendance_id,
      new.assigned_to
    );
  elsif tg_op = 'UPDATE' then
    new.status_updated_at := old.status_updated_at;
    new.status_updated_work_date := old.status_updated_work_date;
    new.status_updated_attendance_id := old.status_updated_attendance_id;
    new.status_updated_by := old.status_updated_by;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- protect_sales_lead_fields(): entry_date rename carried through, plus the
-- three new source/batch columns are now immutable after insert for EVERY
-- caller (including management) - they're provenance, not something anyone
-- edits after the fact.
-- ----------------------------------------------------------------------------
create or replace function public.protect_sales_lead_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source_batch_id is distinct from old.source_batch_id
    or new.source_sheet is distinct from old.source_sheet
    or new.source_row_number is distinct from old.source_row_number
  then
    raise exception 'Import source metadata cannot be changed after creation.';
  end if;

  if not (public.is_sales_team_lead_or_manager() or public.is_admin_or_hr()) then
    if new.assigned_to is distinct from old.assigned_to
      or new.created_by is distinct from old.created_by
      or new.entry_date is distinct from old.entry_date
    then
      raise exception 'Only Sales Team-Lead/Manager/Admin/HR can reassign a lead or change its source details.';
    end if;
  end if;
  return new;
end;
$$;

-- Only change to the existing sales_leads RLS: INSERT no longer has a
-- self-assign exception for regular employees. select/update/delete are
-- untouched - assigned_to = auth.uid() already excludes unassigned rows for
-- a regular employee, so "cannot access unassigned records" was already
-- true and needs no new policy.
drop policy if exists sales_leads_insert on public.sales_leads;
create policy sales_leads_insert on public.sales_leads
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_sales_import_authorized()
  );

-- ----------------------------------------------------------------------------
-- Indexes for the new columns + the idempotency constraint.
-- ----------------------------------------------------------------------------
create index sales_leads_status_updated_work_date_idx on public.sales_leads(status_updated_work_date desc nulls last);
create index sales_leads_status_updated_attendance_id_idx on public.sales_leads(status_updated_attendance_id);
create index sales_leads_source_batch_id_idx on public.sales_leads(source_batch_id);

-- The actual duplicate-IMPORT guard (not a candidate-duplicate guard): the
-- same physical (batch, sheet, row number) can never be inserted twice, so
-- retrying an upload is safe, while re-uploading a file as a NEW batch (or
-- the same candidate appearing many times within one batch, each at a
-- different row number) is always allowed.
create unique index sales_leads_source_row_unique_idx
  on public.sales_leads(source_batch_id, source_sheet, source_row_number)
  where source_batch_id is not null;

-- sales_daily_reports gains the attendance record it was actually generated
-- for, so a submitted report is traceable back to the exact shift - the
-- report's own totals remain an immutable snapshot regardless (nothing
-- ever recomputes them after insert).
alter table public.sales_daily_reports
  add column if not exists attendance_id uuid references public.attendance(id) on delete set null;
