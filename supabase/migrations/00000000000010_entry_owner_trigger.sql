-- ============================================================================
-- Fix: "new row violates row-level security policy" when a non-Admin/HR user
-- adds an Interview/Screening entry.
--
-- The insert policy is `created_by = auth.uid() or is_admin_or_hr()`. The
-- client was sending `created_by: profile?.uid || null`, so whenever the
-- profile had not finished loading it sent NULL — and `NULL = auth.uid()`
-- is NULL, not true. Admin/HR slipped through on the second branch, which
-- is why this only broke for regular employees.
--
-- The client has no business asserting who created a row anyway (it is both
-- fragile and spoofable), so ownership now belongs to the database: this
-- BEFORE INSERT trigger stamps created_by from the authenticated session
-- whenever it is absent. PostgreSQL runs BEFORE ROW triggers before
-- evaluating the RLS WITH CHECK clause, so the policy sees the corrected row.
-- ============================================================================

create or replace function public.set_interview_screening_entry_owner()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.created_by_name is null or btrim(new.created_by_name) = '' then
    select full_name into new.created_by_name
    from public.profiles
    where id = new.created_by;
  end if;

  return new;
end;
$$;

create trigger interview_screening_entries_set_owner
  before insert on public.interview_screening_entries
  for each row execute function public.set_interview_screening_entry_owner();
