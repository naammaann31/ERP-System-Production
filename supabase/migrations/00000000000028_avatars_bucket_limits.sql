-- ============================================================================
-- Server-side enforcement for the "avatars" bucket (migration 27).
--
-- Previously, the 5 MB / image-only restriction only existed as client-side
-- JavaScript validation in lib/avatar.ts — not a real boundary, since the
-- avatars_bucket_insert RLS policy only checks bucket_id and the path's uid
-- segment, nothing about the file itself. Anyone calling the Storage API
-- directly (bypassing the app's UI) could upload an arbitrarily large or
-- non-image file.
--
-- file_size_limit and allowed_mime_types are built-in storage.buckets
-- columns enforced by Supabase Storage itself, before a file is written —
-- this applies regardless of how the upload request is made. The client-side
-- check in lib/avatar.ts is left in place; it now serves only as an instant,
-- friendly error message, with this as the actual backstop. Values match
-- lib/avatar.ts's existing check exactly, so a legitimate user never sees a
-- mismatch between what the UI allowed and what the server accepted.
-- ============================================================================

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';
