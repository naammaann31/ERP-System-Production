-- marketing_daily_reports has no earlier migration in this repo (it was
-- created directly on the live database at some point, outside version
-- control) — using IF NOT EXISTS here rather than a CREATE TABLE so this
-- applies safely on top of whatever already exists there.
--
-- Adds a free-text column for the candidate name(s) behind an RTR
-- submission. RTR has no underlying queryable source anywhere else in the
-- schema (unlike Candidates/Applications, which are computed from the
-- marketing table) — it has always been a number the employee types in by
-- hand, so the name(s) are captured the same way, alongside it.
alter table public.marketing_daily_reports
  add column if not exists rtr_names text;
