-- ============================================================================
-- Interview & Screening: editable Remarks + ERP-added rows.
--
-- The Google Sheet stays the read-only source (Google's CSV export is
-- one-way; writing would need authenticated Sheets API access). These two
-- tables layer ERP-side edits on top of it:
--
--   interview_screening_remarks  — Remark overrides for rows that exist in
--     the sheet. Keyed by a content signature (date|candidate|client)
--     rather than row number, so an edit stays attached to the right
--     record even if rows are inserted or reordered in the sheet.
--
--   interview_screening_entries  — Rows created via "Add Data" in the ERP.
--     These do not exist in the sheet at all.
-- ============================================================================

create table public.interview_screening_remarks (
  row_sig text primary key,
  section text not null check (section in ('interview', 'screening')),
  remark text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_by_name text,
  updated_at timestamptz not null default now()
);

comment on table public.interview_screening_remarks is
  'ERP-side Remark overrides for Google Sheet rows, keyed by content signature (lower(trim(date))|candidate|client).';

create table public.interview_screening_entries (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('interview', 'screening')),
  entry_date text,
  candidate text,
  client text,
  -- "Stage (No of Round)" for interview rows, "Screening/AI" for screening rows
  stage text,
  recruiter text,
  remarks text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index interview_screening_entries_section_idx
  on public.interview_screening_entries(section);

-- ----------------------------------------------------------------------------
-- RLS — mirrors how the Interview & Screening tab already behaves: the sheet
-- is a shared team resource visible to everyone who can open the Data tab,
-- so reads and remark edits are open to authenticated users. Deleting an
-- ERP-added row is limited to its creator or Admin/HR.
-- ----------------------------------------------------------------------------
alter table public.interview_screening_remarks enable row level security;

create policy is_remarks_select on public.interview_screening_remarks
  for select to authenticated using (true);

create policy is_remarks_insert on public.interview_screening_remarks
  for insert to authenticated with check (true);

create policy is_remarks_update on public.interview_screening_remarks
  for update to authenticated using (true) with check (true);

create policy is_remarks_delete on public.interview_screening_remarks
  for delete to authenticated using (public.is_admin_or_hr());

alter table public.interview_screening_entries enable row level security;

create policy is_entries_select on public.interview_screening_entries
  for select to authenticated using (true);

create policy is_entries_insert on public.interview_screening_entries
  for insert to authenticated
  with check (created_by = auth.uid() or public.is_admin_or_hr());

create policy is_entries_update on public.interview_screening_entries
  for update to authenticated using (true) with check (true);

create policy is_entries_delete on public.interview_screening_entries
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin_or_hr());
