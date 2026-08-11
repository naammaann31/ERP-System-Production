-- ============================================================================
-- One-time data backfill: relink marketing/sales rows whose created_by went
-- NULL (via ON DELETE SET NULL when an employee account was deleted and
-- later recreated with a new id) back to the CURRENT profile with a
-- matching name — but only when the name matches exactly one profile, to
-- avoid misattributing data on an ambiguous/duplicate name.
-- ============================================================================

update public.marketing m
set created_by = matched.id
from (
  select lower(trim(full_name)) as norm_name, (array_agg(id))[1] as id
  from public.profiles
  group by lower(trim(full_name))
  having count(*) = 1
) matched
where m.created_by is null
  and m.created_by_name is not null
  and lower(trim(m.created_by_name)) = matched.norm_name;

update public.sales s
set created_by = matched.id
from (
  select lower(trim(full_name)) as norm_name, (array_agg(id))[1] as id
  from public.profiles
  group by lower(trim(full_name))
  having count(*) = 1
) matched
where s.created_by is null
  and s.internal_name is not null
  and lower(trim(s.internal_name)) = matched.norm_name;
