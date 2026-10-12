-- ============================================================================
-- Close an RLS gap on documents (table + storage bucket): both SELECT
-- policies were written as `using (true)` / `using (bucket_id = 'documents')`
-- in the original migrations — i.e. any authenticated user could read every
-- document's metadata, and request a signed URL for any file in the bucket,
-- regardless of who uploaded it or its scope.
--
-- lib/documents.ts's listenToDocuments() only ever filtered this down to
-- "company" scope + the viewer's own uploads on the CLIENT, after already
-- fetching every row — real enforcement was never happening at the database
-- layer, the same mistake already found and fixed for attendance/
-- leave_requests (migration 23) and candidates_select (migration 24).
--
-- New rule:
--   - a user always sees documents they uploaded themselves
--   - "company"-scope documents stay visible to everyone (unchanged,
--     intentional — these are meant to be broadcast the same way
--     announcements are, not a new restriction)
--   - Admin / HR / OPS_HR see everyone's documents, any scope
--     (is_admin_or_hr() already covers all three; confirmed intentional —
--     OPS_HR is meant to have the same full visibility here as Admin/HR)
--   - every other role is now genuinely limited to their own uploads +
--     company-wide documents; a regular employee or Team-Lead can no longer
--     see another employee's "personal" document metadata or storage_path
--
-- The storage bucket policy mirrors the table policy using the same
-- {scope}/{uploader_uid}/{timestamp}_{filename} path convention the
-- INSERT/UPDATE/DELETE bucket policies already rely on (migration 3).
-- ============================================================================

drop policy if exists documents_select on public.documents;

create policy documents_select on public.documents
  for select to authenticated
  using (
    uploaded_by = auth.uid()
    or scope = 'company'
    or public.is_admin_or_hr()
  );

drop policy if exists documents_bucket_select on storage.objects;

create policy documents_bucket_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (storage.foldername(name))[1] = 'company'
      or public.is_admin_or_hr()
    )
  );
