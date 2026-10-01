-- interview_screening_entries' SELECT policy was found to be
-- `(created_by = auth.uid()) or is_admin_or_hr()` on the live database —
-- restricted to each row's own creator — which does not match either the
-- original migration (00000000000009, which specified `using (true)`) or
-- the actual requirement: every Marketing employee, the Marketing Team
-- Lead (including the T&D Manager override), and Admin specifically —
-- not HR — should see every row.
--
-- Deliberately uses public.is_admin() (Admin only) here, NOT
-- public.is_admin_or_hr() (which also includes HR/OPS_HR) — HR should not
-- see this table. Everything else reuses the same, already-existing
-- functions the sibling `marketing` table's own SELECT policy uses
-- (migration 00000000000015); no other policy on this table is touched.

drop policy if exists is_entries_select on public.interview_screening_entries;

create policy is_entries_select on public.interview_screening_entries
  for select to authenticated
  using (
    public.current_role_name() = 'MARKETING'
    or public.is_admin()
    or public.is_marketing_team_lead()
  );
