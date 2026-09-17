-- ============================================================================
-- Employee-specific Marketing Team Lead access override.
--
-- Yudhisthir Soni (T&D Manager, Sales department) is granted the same
-- Marketing Team Lead access as an actual role='MARKETING' Team-Lead —
-- full visibility into the marketing leads table and full candidate
-- management — without changing his role, department, or designation.
-- He remains SALES / Manager / "T & D Manager" everywhere else in the app.
--
-- This is kept as a single override function, checked by user id, so the
-- exception is easy to find, audit, and revoke later without touching the
-- standard role/designation logic that governs every other Team-Lead.
-- ============================================================================

create or replace function public.has_marketing_teamlead_override()
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = 'f84b92cc-7950-4304-b6e4-37b5056140aa'::uuid; -- Yudhisthir Soni
$$;

-- Used by candidates_select/insert/update/delete (migration 12). Redefining
-- it here automatically extends the override to all four policies; the
-- existing role/designation/job_role logic is preserved verbatim.
create or replace function public.is_marketing_team_lead()
returns boolean
language sql stable security definer set search_path = public as $$
  select (
    public.current_role_name() = 'MARKETING'
    and (public.current_designation() = 'Team-Lead' or public.current_job_role() = 'Team-Lead')
  )
  or public.has_marketing_teamlead_override();
$$;

-- Grants visibility into every marketing lead, matching what an actual
-- MARKETING + Team-Lead sees. The existing clauses are preserved verbatim;
-- only the override clause is added.
drop policy if exists marketing_select on public.marketing;

create policy marketing_select on public.marketing
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin_or_hr()
    or (public.current_role_name() = 'MARKETING' and public.current_designation() = 'Team-Lead')
    or public.has_marketing_teamlead_override()
  );
