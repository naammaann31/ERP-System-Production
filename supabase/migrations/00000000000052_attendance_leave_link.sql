-- ============================================================================
-- Attendance <-> Leave (EL/CL) integration.
--
-- Two purely additive changes, same spirit as migration 32 (which widened
-- this exact constraint to add 'Holiday (Paid)'):
--
--   1. attendance.status may now also be 'Earned Leave' or 'Casual Leave',
--      so an approved EL/CL leave request can be reflected on the
--      Attendance calendar instead of showing as a blank/absent day.
--
--   2. attendance.leave_request_id - a nullable link back to the specific
--      leave_requests row that explains a given attendance day. This is
--      the single source of truth for "has this day already been
--      accounted for by a leave application" - used by both directions of
--      the new integration:
--        - approving a leave_requests row writes this on every attendance
--          day it covers (lib/leave.ts's updateLeaveStatus)
--        - HR picking EL/CL directly on the Attendance screen checks this
--          first, so the same day is never deducted twice
--          (components/dashboard/attendance/HRAttendanceDashboard.tsx)
--
-- No existing row is touched: every attendance row that already exists
-- gets leave_request_id = null (the column's default), and no existing
-- status value is removed from the allowed list.
-- ============================================================================

alter table public.attendance drop constraint if exists attendance_status_check;

alter table public.attendance add constraint attendance_status_check
  check (status in ('Present', 'Checked In', 'Absent', 'On Leave', 'Week Off', 'Holiday (Paid)', 'Earned Leave', 'Casual Leave'));

alter table public.attendance
  add column if not exists leave_request_id uuid references public.leave_requests(id) on delete set null;

comment on column public.attendance.leave_request_id is
  'Links this attendance day to the specific leave_requests row that explains it (EL/CL only). Null for every ordinary Present/Absent/Week Off/Holiday day, and for every attendance row that existed before this feature. Set exactly once per day - either by approving a leave request (which stamps every date it covers) or by HR assigning EL/CL directly on the Attendance screen (which creates a backing single-day leave_requests row the first time, then only ever reads this column on subsequent edits to avoid a duplicate deduction).';

-- ----------------------------------------------------------------------------
-- Hardening added after review, before this was ever applied live:
--
--   3. created_via_attendance - a real flag (not a reason-text guess)
--      marking the single-day leave_requests rows createAttendanceLinkedLeave()
--      creates. HRAttendanceDashboard.tsx's "revert away from EL/CL" path
--      checks THIS column, plus the row's current status, plus whether a
--      payroll record already exists for that month, before it's allowed
--      to auto-reject one of these rows - a plain reason-string match is
--      not a strict enough ownership check on its own.
--
--   4. A partial unique index enforcing "at most one
--      created_via_attendance row per employee per single day" AT THE
--      DATABASE LEVEL, not just in application code - closes the race
--      where two HR users (or two tabs) both see leave_request_id = null
--      for the same day and both try to create a backing row at once. The
--      second insert now fails with a unique violation instead of
--      succeeding, so the application code can detect that and reuse the
--      winning row instead of creating a duplicate.
-- ----------------------------------------------------------------------------

alter table public.leave_requests
  add column if not exists created_via_attendance boolean not null default false;

comment on column public.leave_requests.created_via_attendance is
  'True only for the single-day Approved row createAttendanceLinkedLeave() creates when HR assigns EL/CL directly on the Attendance screen for a day with no existing application. False for every employee-submitted application and every row that existed before this feature - the one-time opening-balance seed script already creates no leave_requests rows at all, so this never conflicts with that history. Used as the strict ownership check before the Attendance screen is allowed to auto-reject a row on revert.';

create unique index if not exists leave_requests_one_attendance_entry_per_day
  on public.leave_requests (user_id, start_date)
  where created_via_attendance = true;
