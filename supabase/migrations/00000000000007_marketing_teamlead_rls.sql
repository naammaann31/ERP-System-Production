-- ============================================================================
-- Marketing RLS fix: distinguish Team-Lead from individual employee.
--
-- Previously, marketing_select granted any role='MARKETING' user read
-- access to ALL marketing rows (same broad pattern as sales), while the
-- app's UI happened to filter individual employees down to their own rows
-- via client-side JS only — not a real enforced boundary, and it also
-- never gave Team-Leads any broader access than a regular employee since
-- nothing checked `designation` at all.
--
-- New behavior, enforced at the database level:
--   - creator always sees their own rows
--   - Admin/HR see everything
--   - MARKETING role + designation = 'Team-Lead' sees everything
--   - MARKETING role + any other designation sees only their own rows
-- ============================================================================

create or replace function public.current_designation()
returns text
language sql stable security definer set search_path = public as $$
  select designation from public.profiles where id = auth.uid();
$$;

drop policy if exists marketing_select on public.marketing;

create policy marketing_select on public.marketing
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin_or_hr()
    or (public.current_role_name() = 'MARKETING' and public.current_designation() = 'Team-Lead')
  );
