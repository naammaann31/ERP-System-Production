-- ============================================================================
-- Splits the single leave pool into Earned Leave (EL, carries forward
-- forever) and Casual Leave (CL, resets every financial year on April 1).
-- See lib/leave.ts's calculateElClBalances() for the full accrual/rollover
-- math.
--
-- Two separate, deliberate pieces:
--
-- 1. leave_requests.leave_category - tags every FUTURE leave application
--    with which balance it draws from. Existing rows are backfilled to
--    'Earned Leave' purely as a label (this backfill does NOT affect anyone's
--    balance - see point 2).
--
-- 2. profiles.el_opening_balance / cl_opening_balance - a ONE-TIME, frozen
--    snapshot of each employee's current balance, split via the exact
--    rounding rule given (even: equal; odd: extra day to EL; decimal
--    remainder: to CL). This is the ONLY mechanism used for the initial
--    bifurcation - explicitly NOT a Manual Credit/Deduction leave_requests
--    row, per the requirement that the conversion must never touch the
--    leave_requests ledger or alter anyone's historical records. Both
--    columns are set exactly once by scripts/seed-el-cl-opening-balances.js
--    and never written to again by any ongoing code path - the ongoing
--    EL/CL formulas treat them as a fixed constant, the same way they treat
--    an employee's date_of_joining.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention.
-- Run scripts/seed-el-cl-opening-balances.js AFTER this migration is live.
-- ============================================================================

-- Guarded with IF NOT EXISTS: a prior, since-reverted attempt at this same
-- feature already added this exact column (and was never dropped), so this
-- statement is a no-op on a database where it's already present, and a
-- normal ADD COLUMN on one where it isn't.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leave_requests' and column_name = 'leave_category'
  ) then
    alter table public.leave_requests
      add column leave_category text not null default 'Earned Leave'
      check (leave_category in ('Earned Leave', 'Casual Leave'));
  end if;
end $$;

comment on column public.leave_requests.leave_category is
  'Earned Leave (lifetime, carries forward) or Casual Leave (resets every financial year, 1 April). Existing rows default to Earned Leave as a label only - see migration 51 header comment; this column never affects balances by itself.';

alter table public.profiles
  add column if not exists el_opening_balance numeric,
  add column if not exists cl_opening_balance numeric;

-- Marks exactly which pre-existing leave_requests rows were already summed
-- into an employee's opening balance, so the ongoing EL/CL formula can
-- exclude them by identity rather than by guessing from a date field (a
-- leave can be approved AFTER the split even though it was already
-- PENDING before it, or dated in the future relative to when the split
-- ran — neither start_date nor applied_on alone can distinguish "already
-- counted" from "not yet counted" in every case; an explicit flag can).
alter table public.leave_requests
  add column if not exists counted_in_opening_balance boolean not null default false;

comment on column public.leave_requests.counted_in_opening_balance is
  'True for a pre-existing row that was already summed into this employee''s one-time EL/CL opening balance - permanently excluded from ongoing EL/CL "used" calculations to prevent double-counting. Every row created after the split defaults to false and is never touched again.';

comment on column public.profiles.el_opening_balance is
  'One-time frozen snapshot of this employee''s Earned Leave balance at the moment the EL/CL split was introduced. Set exactly once by scripts/seed-el-cl-opening-balances.js - never written to again. Null means the employee was never converted (joined after the split, or the split has not run for them yet).';
comment on column public.profiles.cl_opening_balance is
  'One-time frozen snapshot of this employee''s Casual Leave balance at the moment the EL/CL split was introduced, for the financial year the split happened in only - it stops counting once that financial year ends (Casual Leave never carries forward). Set exactly once by scripts/seed-el-cl-opening-balances.js - never written to again.';
