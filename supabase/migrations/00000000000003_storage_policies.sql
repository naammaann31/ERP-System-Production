-- ============================================================================
-- Vectra ERP — Storage policies for the "documents" bucket
-- Object path convention: {scope}/{uploader_uid}/{timestamp}_{filename}
-- e.g. "company/3f2a.../1699999999_offer_letter.pdf"
-- ============================================================================

-- Ensure the bucket is private (no public URL access without a signed URL).
update storage.buckets set public = false where id = 'documents';

-- Any authenticated user can view file metadata/download (matches the
-- documents table's broad SELECT policy — scope-based filtering for
-- "personal" documents happens in the app query, same as the original
-- Firestore-backed behavior).
create policy documents_bucket_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documents');

-- Only the uploader (2nd path segment = their uid) or Admin/HR may upload.
create policy documents_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_admin_or_hr()
    )
  );

create policy documents_bucket_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_admin_or_hr()
    )
  );

create policy documents_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_admin_or_hr()
    )
  );
