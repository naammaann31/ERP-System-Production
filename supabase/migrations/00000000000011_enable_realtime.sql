-- ============================================================================
-- Enable Supabase Realtime for the app's tables.
--
-- postgres_changes subscriptions only receive events for tables that belong
-- to the `supabase_realtime` publication. New tables are NOT added to it
-- automatically, so every .on("postgres_changes", ...) in the app is silently
-- inert until the table is published — which is why the UI only updated on a
-- manual refresh.
--
-- REPLICA IDENTITY FULL makes the old row available on UPDATE/DELETE events.
-- Without it Postgres only emits the primary key, so subscriptions that use a
-- filter (e.g. notifications on user_id, profiles on id) never match a delete.
-- These tables are low-volume, so the extra WAL cost is negligible.
-- ============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'attendance',
    'leave_requests',
    'salary_structures',
    'payrolls',
    'announcements',
    'documents',
    'notifications',
    'audit_logs',
    'sales',
    'marketing',
    'interview_screening_entries'
  ];
begin
  foreach t in array tables loop
    -- REPLICA IDENTITY FULL is safe to re-apply
    execute format('alter table public.%I replica identity full', t);

    -- only add to the publication if it isn't already a member
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Lets the app confirm which tables are actually publishing realtime events.
create or replace function public.realtime_published_tables()
returns table(table_name text)
language sql stable security definer set search_path = public as $$
  select tablename::text
  from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public'
  order by tablename;
$$;
