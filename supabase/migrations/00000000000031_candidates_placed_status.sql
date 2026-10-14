-- ============================================================================
-- Add "Placed" as a candidates.status option.
--
-- Candidate status was fixed at New/Contacted/Interviewing/Selected/Rejected/
-- On Hold (migration 12). The team needs a distinct status for a candidate
-- who has actually been placed with a client, separate from "Selected"
-- (selected by the client, not yet placed/started).
-- ============================================================================

alter table public.candidates drop constraint if exists candidates_status_check;

alter table public.candidates add constraint candidates_status_check
  check (status in ('New', 'Contacted', 'Interviewing', 'Selected', 'Rejected', 'On Hold', 'Placed'));
