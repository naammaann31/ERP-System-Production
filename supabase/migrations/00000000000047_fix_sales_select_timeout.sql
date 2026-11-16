-- ============================================================================
-- Fix: "canceling statement due to statement timeout" (Postgres 57014) when
-- loading Sales Data / Master Data.
--
-- Same root cause already found and fixed for Marketing in migration 44:
-- is_sales_team_lead_or_manager() and is_admin_or_hr() are both
-- `language sql stable security definer` functions, but every Sales-module
-- RLS policy called them BARE inside USING, e.g.:
--   using (assigned_to = auth.uid() or is_sales_team_lead_or_manager() or is_admin_or_hr())
-- Postgres does not know these calls are safe to evaluate once per query -
-- a bare call like this can be re-run once per ROW. That was invisible while
-- sales_leads was empty; now that real leads have been imported, scanning
-- thousands of rows each re-running two function calls is slow enough to
-- hit the statement timeout.
--
-- Fix: wrap each call as `(select is_sales_team_lead_or_manager())` /
-- `(select is_admin_or_hr())`. This is the documented Postgres/Supabase
-- InitPlan-hoisting pattern - wrapping a non-correlated, non-volatile
-- function call in a scalar subquery lets the planner evaluate it exactly
-- once per query instead of once per row. No behavior change, pure
-- performance fix - every policy still grants access to exactly the same
-- people it did before.
--
-- Covers every Sales-module USING clause with this pattern (not just the
-- one that happened to surface the error first - update/delete and the
-- newer sales_import_batches/sales_lead_status_history/sales_daily_reports
-- tables all have the identical bare-call pattern and would hit the same
-- wall as they grow). INSERT policies are left untouched, matching
-- migration 44's own precedent - a WITH CHECK clause only evaluates against
-- the row(s) actually being inserted, not a full-table scan, so it isn't
-- subject to the same per-row blowup.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention.
-- ============================================================================

drop policy if exists sales_leads_select on public.sales_leads;
create policy sales_leads_select on public.sales_leads
  for select to authenticated
  using (
    assigned_to = auth.uid()
    or (select public.is_sales_team_lead_or_manager())
    or (select public.is_admin_or_hr())
  );

drop policy if exists sales_leads_update on public.sales_leads;
create policy sales_leads_update on public.sales_leads
  for update to authenticated
  using (
    assigned_to = auth.uid()
    or (select public.is_sales_team_lead_or_manager())
    or (select public.is_admin_or_hr())
  );

drop policy if exists sales_leads_delete on public.sales_leads;
create policy sales_leads_delete on public.sales_leads
  for delete to authenticated
  using (
    (select public.is_sales_team_lead_or_manager())
    or (select public.is_admin_or_hr())
  );

drop policy if exists sales_custom_columns_select on public.sales_custom_columns;
create policy sales_custom_columns_select on public.sales_custom_columns
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (select public.is_sales_team_lead_or_manager())
    or (select public.is_admin_or_hr())
  );

drop policy if exists sales_daily_reports_select on public.sales_daily_reports;
create policy sales_daily_reports_select on public.sales_daily_reports
  for select to authenticated
  using (
    user_id = auth.uid()
    or (select public.is_sales_team_lead_or_manager())
    or (select public.is_admin_or_hr())
  );

drop policy if exists sales_daily_reports_update on public.sales_daily_reports;
create policy sales_daily_reports_update on public.sales_daily_reports
  for update to authenticated
  using ((select public.is_sales_team_lead_or_manager()) or (select public.is_admin_or_hr()));

drop policy if exists sales_daily_reports_delete on public.sales_daily_reports;
create policy sales_daily_reports_delete on public.sales_daily_reports
  for delete to authenticated
  using ((select public.is_sales_team_lead_or_manager()) or (select public.is_admin_or_hr()));

drop policy if exists sales_import_batches_select on public.sales_import_batches;
create policy sales_import_batches_select on public.sales_import_batches
  for select to authenticated
  using ((select public.is_sales_team_lead_or_manager()) or (select public.is_admin_or_hr()));

drop policy if exists sales_lead_status_history_select on public.sales_lead_status_history;
create policy sales_lead_status_history_select on public.sales_lead_status_history
  for select to authenticated
  using (
    assigned_to_at_change = auth.uid()
    or (select public.is_sales_team_lead_or_manager())
    or (select public.is_admin_or_hr())
  );
