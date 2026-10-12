-- ============================================================================
-- Employee profile photos.
--
-- Adds profiles.avatar_url and a new "avatars" Storage bucket. Photos are
-- directory data, same philosophy as profiles_select (using(true)) --
-- visible to the whole company, not scoped per-department or per-manager.
-- Unlike the "documents" bucket, this one is marked PUBLIC: a profile photo
-- isn't sensitive the way an ID proof or bank letter is, and a public
-- bucket avoids any signed-URL/expiry management for something shown on
-- every page of the app.
--
-- Upload rights: an employee can set/replace their own photo, and Admin/HR
-- can set/replace anyone's (e.g. during onboarding) -- explicit project-
-- owner decision. Path convention: {uid}/{timestamp}_{filename}, mirroring
-- the {scope}/{uploader_uid}/... convention already used by the documents
-- bucket (migration 3), just without the scope segment since there's only
-- one kind of object here.
-- ============================================================================

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_bucket_insert on storage.objects;
create policy avatars_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin_or_hr()
    )
  );

drop policy if exists avatars_bucket_update on storage.objects;
create policy avatars_bucket_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin_or_hr()
    )
  );

drop policy if exists avatars_bucket_delete on storage.objects;
create policy avatars_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin_or_hr()
    )
  );

-- No SELECT policy needed: the bucket is public, so objects are served
-- directly via the public URL without going through storage.objects RLS.
