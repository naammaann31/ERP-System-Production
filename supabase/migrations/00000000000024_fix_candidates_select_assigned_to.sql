-- ============================================================================
-- Fix candidates_select: it was checking created_by instead of assigned_to.
--
-- Migration 12 defined this policy correctly (assigned_to = auth.uid() OR
-- is_admin_or_hr() OR is_marketing_team_lead()), but the LIVE policy had
-- drifted to using created_by instead — almost certainly a direct dashboard
-- edit at some point that was never captured in a migration, the same class
-- of drift already documented for interview_screening_entries (migration 20).
--
-- Why this broke the feature for every regular marketing employee, not just
-- one person: candidates_insert only allows Admin/HR/Team-Lead to create a
-- row (regular employees are deliberately read-only), so created_by can
-- never equal a regular employee's own uid — not for one candidate, not for
-- any candidate. The "assigned_to" column is the only one ever set to a
-- regular employee's id, so checking created_by instead silently made every
-- assigned candidate invisible to the person it was assigned to, with no
-- error anywhere (RLS just filters quietly).
--
-- Confirmed before this fix: a candidate assigned to a specific employee by
-- a Team-Lead did not appear in that employee's own "My Candidates" view
-- even after a hard refresh, while the assigned_to column itself was
-- verified correct against the database.
--
-- This migration restores the policy to migration 12's original intent and
-- gives it a tracked record — the live database and version control were
-- out of sync before this, which is exactly the gap this closes.
-- ============================================================================

drop policy if exists candidates_select on public.candidates;

create policy candidates_select on public.candidates
  for select to authenticated
  using (
    assigned_to = auth.uid()
    or public.is_admin_or_hr()
    or public.is_marketing_team_lead()
  );
