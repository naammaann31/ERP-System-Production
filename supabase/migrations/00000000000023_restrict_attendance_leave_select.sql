-- ============================================================================
-- Close an RLS gap on attendance and leave_requests: both tables' SELECT
-- policies were written as `using (true)` in the very first RLS migration —
-- i.e. "any authenticated user can read every row" — and were never tightened
-- the way marketing, candidates, and payrolls later were.
--
-- In practice this meant any logged-in employee, regardless of role or
-- department, could read every other employee's check-in/check-out times,
-- attendance status, and leave requests directly via the API — the
-- dashboards only *displayed* this selectively per role, which is UI
-- decoration, not a real boundary (the same mistake documented in migration
-- 7 for marketing_select).
--
-- New rule, matching what payrolls_select already does:
--   - a user always sees their own rows (past and present — no date limit)
--   - Admin / HR / OPS_HR see everyone's (is_admin_or_hr() already covers
--     all three), unchanged from today
--   - every other role — including Team-Lead — is now genuinely limited to
--     their own data only. Deliberate choice: Team-Lead is intentionally NOT
--     exempted here, even though the employee profile page
--     (/dashboard/employees/[uid]) currently calls
--     getUserAttendanceForMonth() for whichever employee is being viewed —
--     for a Team-Lead viewing a team member, that call now returns no rows
--     (RLS-filtered), so that page's attendance section will show empty for
--     anyone but Admin/HR/OPS_HR. That's accepted as part of this change,
--     not an oversight.
-- ============================================================================

drop policy if exists attendance_select on public.attendance;

create policy attendance_select on public.attendance
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_hr());

drop policy if exists leave_requests_select on public.leave_requests;

create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_hr());
