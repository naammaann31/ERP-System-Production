-- Admin and the Marketing Team Lead (which already includes the T&D
-- Manager override via is_marketing_team_lead()) get full edit + delete
-- rights on every interview_screening_entries row. Everyone else keeps
-- exactly what they already have today: open editing of the `remarks`
-- field only, on any row — unchanged. Nobody else gets delete at all (no
-- delete UI has ever existed for a regular employee, so this isn't a
-- removal of a working feature).

-- ----------------------------------------------------------------------------
-- DELETE: Admin or Marketing Team Lead only.
-- ----------------------------------------------------------------------------
drop policy if exists is_entries_delete on public.interview_screening_entries;

create policy is_entries_delete on public.interview_screening_entries
  for delete to authenticated
  using (
    public.is_admin()
    or public.is_marketing_team_lead()
  );

-- ----------------------------------------------------------------------------
-- UPDATE: column-level enforcement via trigger, since RLS's declarative
-- using/with check cannot compare a submitted value against the row's prior
-- value on its own. The policy stays wide open (unchanged from before);
-- this trigger is what actually restricts a non-Admin/non-Team-Lead update
-- to the `remarks` column only, by silently reverting every other column
-- back to what it already was — regardless of what the client submitted.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_entries_update_scope()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.is_marketing_team_lead() then
    return new;
  end if;

  new.section := old.section;
  new.entry_date := old.entry_date;
  new.candidate := old.candidate;
  new.client := old.client;
  new.stage := old.stage;
  new.recruiter := old.recruiter;
  new.created_by := old.created_by;
  new.created_by_name := old.created_by_name;
  new.created_at := old.created_at;
  return new;
end;
$$;

-- Named to sort alphabetically before trg_entry_date_sort (migration
-- 00000000000019), so entry_date is reverted here FIRST if a non-privileged
-- update tried to change it — the date-sort trigger then correctly
-- recomputes entry_date_sort/entry_date_value from that reverted value,
-- i.e. no change, rather than from a tampered one.
drop trigger if exists trg_enforce_entries_update_scope on public.interview_screening_entries;
create trigger trg_enforce_entries_update_scope
  before update on public.interview_screening_entries
  for each row execute function public.enforce_entries_update_scope();
