-- ============================================================================
-- LinkedIn URL for the "Vectra Team" company directory.
--
-- Plain, non-privileged profile field — same philosophy as full_name/phone:
-- an employee can set/edit their own, and Admin/HR can set or correct
-- anyone's (e.g. during onboarding, before the employee has filled it in
-- themselves). Explicit project-owner decision.
--
-- No RLS changes needed. profiles_select is already using(true) (directory
-- data, see migration 2), and profiles_update is already
-- `auth.uid() = id or is_admin_or_hr()` (migration 2) — a new column
-- automatically inherits both, and linkedin_url isn't one of the
-- privileged fields protect_profile_fields() locks down (migration 2/4),
-- so self-edit works without touching that trigger either.
-- ============================================================================

alter table public.profiles add column if not exists linkedin_url text;
