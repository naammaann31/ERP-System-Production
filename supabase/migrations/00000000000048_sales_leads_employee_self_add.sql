-- ============================================================================
-- Allow a regular Sales employee to manually add ONE lead of their own -
-- e.g. a referral or a contact they personally found - without reopening
-- bulk Excel import, which stays Team-Lead/Manager/Admin/HR-only
-- (is_sales_import_authorized() itself is unchanged).
--
-- Per explicit instruction: "for normal sales employee allow them to
-- manually add one entry like add data option." Confirmed scope: the new
-- lead is always auto-assigned to the employee who added it - they can
-- never leave it unassigned or hand it to someone else; reassigning to
-- another employee, or leaving it unassigned, remains Team-Lead/Manager/
-- Admin/HR-only via is_sales_import_authorized(), exactly as already
-- enforced for everything else in this module.
--
-- This re-opens exactly the self-insert exception migration 40 originally
-- had (assigned_to = auth.uid()) before migration 45 removed it entirely
-- for every regular employee - narrowed back in now for this one case only.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention.
-- ============================================================================

drop policy if exists sales_leads_insert on public.sales_leads;
create policy sales_leads_insert on public.sales_leads
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      assigned_to = auth.uid()
      or (select public.is_sales_import_authorized())
    )
  );
