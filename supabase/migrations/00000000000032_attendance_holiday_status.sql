-- ============================================================================
-- Allow "Holiday (Paid)" as a real, writable attendance.status value.
--
-- This status already exists throughout the app's display/calculation logic
-- (HRAttendanceDashboard, EmployeeAttendanceDashboard, EmployeeDetailsModal,
-- WeeklyOverview all already treat it as a counted-as-worked day) but was
-- only ever a synthetic, client-side placeholder for a detected US holiday
-- with no existing attendance row — never actually insertable/updatable,
-- since the original check constraint (migration 1) never included it.
--
-- This migration only widens the constraint so HR can now set it manually
-- from the Attendance "Action" dropdown, same write path as Present/Half
-- Day/Absent/Week Off.
-- ============================================================================

alter table public.attendance drop constraint if exists attendance_status_check;

alter table public.attendance add constraint attendance_status_check
  check (status in ('Present', 'Checked In', 'Absent', 'On Leave', 'Week Off', 'Holiday (Paid)'));
