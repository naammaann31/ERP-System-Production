-- interview_screening_entries.entry_date is free TEXT ("Apr-30", "June 18",
-- or "2026-06-18" from the Add Data date picker) — it cannot be ORDER BY'd
-- directly and still come out "most recent first", and a client-side re-sort
-- (the old approach) only works within whatever page happens to be loaded,
-- which breaks once the table is paginated.
--
-- This adds a real, always-in-sync sort column instead: a trigger computes
-- it from entry_date on every insert/update, mirroring the exact same
-- parsing rules as lib/dateSort.ts's dateSortKey() (shared by Marketing,
-- Sales and this table), so the app code needs no changes at all beyond the
-- ORDER BY clause — every insert path (Add Data, normal import, bulk
-- import) is covered automatically by the trigger.
--
-- Unparseable/empty dates get NULL, which sorts last via nullsFirst:false
-- in the query — mirroring dateSortKey()'s "+Infinity sinks to the bottom"
-- behaviour instead of masquerading as the oldest or newest row.

create or replace function public.entry_date_sort_key(raw text)
returns integer
language plpgsql
immutable
as $$
declare
  s text := trim(coalesce(raw, ''));
  iso_match text[];
  month_first text[];
  day_first text[];
  month_map jsonb := '{"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
                        "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}'::jsonb;
  m int;
  d int;
  y int;
begin
  if s = '' then
    return null;
  end if;

  -- "YYYY-MM-DD", optionally with a time component (the Add Data date picker).
  iso_match := regexp_match(s, '^(\d{4})-(\d{1,2})-(\d{1,2})');
  if iso_match is not null then
    y := iso_match[1]::int;
    m := iso_match[2]::int;
    d := iso_match[3]::int;
    return y * 10000 + m * 100 + d;
  end if;

  -- "Apr-30", "May 1", "June 16" — month name first, no year (bulk imports).
  month_first := regexp_match(s, '^([A-Za-z]{3,9})[\s\-/.]+(\d{1,2})$');
  if month_first is not null then
    m := (month_map ->> lower(left(month_first[1], 3)))::int;
    if m is not null then
      d := month_first[2]::int;
      return m * 100 + d;
    end if;
  end if;

  -- "30-Apr", "16 June" — the same thing the other way round.
  day_first := regexp_match(s, '^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})$');
  if day_first is not null then
    m := (month_map ->> lower(left(day_first[2], 3)))::int;
    if m is not null then
      d := day_first[1]::int;
      return m * 100 + d;
    end if;
  end if;

  -- Anything else (free-form text Date.parse might have caught client-side)
  -- is deliberately left NULL rather than guessed at — worst case it sinks
  -- to the bottom, it never ends up silently misordered.
  return null;
end;
$$;

-- A SECOND, separate derived column for actual date-RANGE filtering (e.g.
-- "give me everything from Sept 1 to Sept 30"), which entry_date_sort can't
-- safely be reused for: it mixes two incompatible scales (a yearless "June
-- 18" sorts as 618, a dated "2026-09-30" sorts as 20260930), so a
-- year-scaled range boundary would silently exclude every yearless row
-- rather than just sorting them — wrong in a different way than the sort
-- problem. This column is only ever populated from the ISO ("YYYY-MM-DD")
-- shape, i.e. entries added via the Add Data date picker; yearless
-- bulk-imported rows deliberately get NULL here rather than a guessed
-- year, so they are correctly left OUT of a date-ranged count instead of
-- silently miscounted under the wrong year.
create or replace function public.entry_date_real(raw text)
returns date
language plpgsql
immutable
as $$
declare
  s text := trim(coalesce(raw, ''));
  iso_match text[];
begin
  if s = '' then
    return null;
  end if;

  iso_match := regexp_match(s, '^(\d{4})-(\d{1,2})-(\d{1,2})');
  if iso_match is not null then
    return make_date(iso_match[1]::int, iso_match[2]::int, iso_match[3]::int);
  end if;

  return null;
end;
$$;

alter table public.interview_screening_entries
  add column if not exists entry_date_sort integer,
  add column if not exists entry_date_value date;

-- Backfill every row that exists today.
update public.interview_screening_entries
set entry_date_sort = public.entry_date_sort_key(entry_date),
    entry_date_value = public.entry_date_real(entry_date);

-- Keep both in sync automatically from now on — no application code needs
-- to compute or send either column.
create or replace function public.set_entry_date_sort()
returns trigger
language plpgsql
as $$
begin
  new.entry_date_sort := public.entry_date_sort_key(new.entry_date);
  new.entry_date_value := public.entry_date_real(new.entry_date);
  return new;
end;
$$;

drop trigger if exists trg_entry_date_sort on public.interview_screening_entries;
create trigger trg_entry_date_sort
  before insert or update of entry_date on public.interview_screening_entries
  for each row execute function public.set_entry_date_sort();

-- Matches the query pattern exactly: filter by section, order by date (most
-- recent first), then by created_at as the tie-breaker.
create index if not exists interview_screening_entries_section_sort_idx
  on public.interview_screening_entries(section, entry_date_sort desc, created_at desc);
