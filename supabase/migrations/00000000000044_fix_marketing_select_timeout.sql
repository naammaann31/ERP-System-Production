-- ============================================================================
-- Fixes a real query-timeout regression introduced by migration 43
-- (Postgres error 57014 "canceling statement due to statement timeout" on
-- SELECT from public.marketing, confirmed live for Asrar Patni on
-- /dashboard/data).
--
-- Root cause: marketing_select calls public.is_marketing_team_lead() bare
-- (no `(select ...)` wrapper). Once that function evaluates to true for a
-- given caller (now true for a Marketing Manager too, per migration 43 —
-- previously only true for a literal 'Team-Lead'), the WHERE clause is
-- effectively "true" for every row in the table, and Postgres cannot always
-- prove a bare SECURITY DEFINER function call is safe to hoist out of the
-- per-row evaluation on its own — it can end up re-executing
-- is_marketing_team_lead() (itself calling three more SECURITY DEFINER
-- functions internally) once for every one of the marketing table's ~160k+
-- rows, instead of once for the whole query. That's what the Marketing
-- Team-Lead path never hit before (it affected one designation value that
-- happened not to trigger this plan shape as reliably) and what the broader
-- Manager grant tipped over into a real timeout.
--
-- Fix: wrap each helper call in `(select ...)`, a documented Postgres/
-- Supabase RLS pattern that forces the planner to evaluate it once per
-- query (an InitPlan) instead of once per row, regardless of how
-- selective/unselective the rest of the clause is. This changes performance
-- characteristics only — the access logic itself (who can see what) is
-- unchanged from migration 43.
-- ============================================================================

drop policy if exists marketing_select on public.marketing;

create policy marketing_select on public.marketing
  for select to authenticated
  using (
    created_by = auth.uid()
    or (select public.is_admin_or_hr())
    or (select public.is_marketing_team_lead())
  );
