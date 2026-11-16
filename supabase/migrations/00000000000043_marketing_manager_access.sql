-- ============================================================================
-- Fixes a confirmed RLS gap: a MARKETING-department Manager (e.g. Asrar
-- Patni, designation = 'Manager', job title "Marketing Manager") was denied
-- full visibility into the marketing table, because is_marketing_team_lead()
-- and the marketing_select policy (migration 15, superseding migration 7's
-- narrower rewrite of migration 2's original broad policy) only recognized
-- the literal designation 'Team-Lead' — not 'Manager'. A real Marketing
-- Team-Lead (designation exactly 'Team-Lead') was never affected by this;
-- only a department head carrying the "Manager" designation was wrongly
-- restricted to their own rows, same as a regular employee.
--
-- ProtectedRoute.tsx already recognizes designation/job_role = 'Manager' as
-- Team-Lead-equivalent (with an explicit comment calling out this exact
-- scenario) — this migration brings the RLS layer in line with that
-- already-established definition. Scope is deliberately limited to the
-- MARKETING role only; Sales' equivalent function
-- (is_sales_team_lead_or_manager(), migration 40) already included
-- 'Manager' from the start and is untouched here.
-- ============================================================================

create or replace function public.is_marketing_team_lead()
returns boolean
language sql stable security definer set search_path = public as $$
  select (
    public.current_role_name() = 'MARKETING'
    and (
      public.current_designation() in ('Team-Lead', 'Manager')
      or public.current_job_role() in ('Team-Lead', 'Manager')
    )
  )
  or public.has_marketing_teamlead_override();
$$;

drop policy if exists marketing_select on public.marketing;

create policy marketing_select on public.marketing
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin_or_hr()
    or public.is_marketing_team_lead()
  );
