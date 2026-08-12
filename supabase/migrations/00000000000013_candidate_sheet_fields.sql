-- ============================================================================
-- Align public.candidates with the columns the marketing team actually tracks:
--
--   NAME | Contact number | Marketing Email | Password | Linkedin Email |
--   Password | Technology | Visa Status
--
-- NAME and Contact number already map to full_name / phone. The rest are new.
--
-- The three generic placeholder columns from migration 12 are superseded and
-- dropped rather than left to rot beside their real equivalents:
--   email     -> marketing_email
--   job_title -> technology
--   source    -> not tracked
-- Safe to drop: verified the table held zero rows at the time of this change.
--
-- NOTE ON THE PASSWORD COLUMNS: these are account credentials the team manages
-- on behalf of candidates, stored as plain text because the team needs to read
-- them back (unlike a login password, which would be hashed). They are exposed
-- only through the candidates_select policy — the assigned employee, the
-- Team-Lead, and Admin/HR. No other employee can read them.
-- ============================================================================

alter table public.candidates
  add column marketing_email    text,
  add column marketing_password text,
  add column linkedin_email     text,
  add column linkedin_password  text,
  add column technology         text,
  add column visa_status        text;

alter table public.candidates
  drop column email,
  drop column job_title,
  drop column source;

comment on column public.candidates.marketing_password is
  'Plain-text account credential managed on the candidate''s behalf; readable only via RLS (assignee, Team-Lead, Admin/HR).';
comment on column public.candidates.linkedin_password is
  'Plain-text account credential managed on the candidate''s behalf; readable only via RLS (assignee, Team-Lead, Admin/HR).';
