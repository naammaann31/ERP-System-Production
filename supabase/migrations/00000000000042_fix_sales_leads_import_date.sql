-- ============================================================================
-- Fixes a confirmed bug in sales_leads_stamp_status (migration 40): the
-- trigger stamped status_updated_at := now() on INSERT whenever the new
-- row's status was non-null — which is true for almost every imported row,
-- since the real Sales Data sheets already carry a Status column (e.g.
-- "Attempt 1", "Not interested"). Because SalesDataTable.tsx's employee
-- "Date" column displays status_updated_at in preference to sourced_date
-- (COALESCE(status_updated_at, sourced_date) — by original design, meant to
-- show "recency of last status change"), every freshly-imported lead
-- displayed today's import date instead of its real sourced_date from the
-- Excel file, even though sourced_date itself was always parsed and stored
-- correctly.
--
-- Fix: status_updated_at is no longer stamped on INSERT at all — the
-- initial status carried in from an import or manual add is the starting
-- state, not a "change". It is still stamped exactly as before on UPDATE,
-- whenever status is genuinely edited afterward — that part of the
-- behavior is unchanged, per explicit instruction.
--
-- NOT APPLIED AUTOMATICALLY - run manually, per this project's convention,
-- only after review.
-- ============================================================================

create or replace function public.stamp_sales_lead_status_updated_at()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

-- One-time backfill: any already-imported row whose status_updated_at was
-- stamped purely by the old buggy INSERT-time behavior (i.e. it was never
-- actually edited after creation — status_updated_at equals created_at's
-- date, to the same calendar day) is reset to null so it falls back to
-- displaying its real sourced_date. A row is left untouched if its
-- status_updated_at predates its created_at's day (not possible) or if
-- there's any other reason to believe a real edit happened — this only
-- clears rows where status_updated_at was set on the same calendar day the
-- row was created, which is the exact signature of the bug (import-day
-- stamp), not a deliberate decision taken days or weeks later.
update public.sales_leads
set status_updated_at = null
where status_updated_at is not null
  and status_updated_at::date = created_at::date;
