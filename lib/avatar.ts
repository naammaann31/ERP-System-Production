import { createClient } from "@/lib/supabase/client";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class AvatarUploadError extends Error {}

function validateFile(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AvatarUploadError("Please choose a JPG, PNG, WEBP, or GIF image.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new AvatarUploadError("Image is too large — please choose a file under 5 MB.");
  }
}

const PUBLIC_URL_MARKER = "/storage/v1/object/public/avatars/";

/** Extracts the bucket-relative object path from a previously stored public avatar URL. */
function pathFromPublicUrl(url: string): string | null {
  const idx = url.indexOf(PUBLIC_URL_MARKER);
  if (idx === -1) return null;
  return url.slice(idx + PUBLIC_URL_MARKER.length);
}

/**
 * Uploads a new photo for `targetUid` and updates profiles.avatar_url.
 * Used both for self-upload (Settings) and Admin/HR setting someone else's
 * photo (Edit Employee) — RLS on the "avatars" bucket and on profiles_update
 * is what actually decides whether the caller is allowed to do this for
 * targetUid, this function just performs the two writes.
 */
export async function uploadAvatar(file: File, targetUid: string): Promise<string> {
  validateFile(file);

  const supabase = createClient();

  // Looked up fresh (not passed in by the caller) so we always clean up
  // whatever is actually in the database right now, not a possibly-stale
  // value sitting in some component's local state.
  const { data: existingRow } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", targetUid)
    .maybeSingle();
  const previousUrl = existingRow?.avatar_url as string | null | undefined;

  const ext = file.name.split(".").pop() || "jpg";
  // Timestamped, so always a fresh path — no need for upsert (which, on
  // Supabase Storage, requires a SELECT policy to check for an existing
  // object first; this bucket intentionally has none, since it's public
  // and served via the public URL, not via authenticated table RLS).
  const path = `${targetUid}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file);
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", targetUid);
  if (updateError) throw updateError;

  // Remove the previous photo now that the new one is confirmed live.
  // Best-effort and non-fatal: the upload itself already succeeded by this
  // point, so a failure here just leaves one orphaned file rather than
  // breaking the operation the caller actually asked for.
  if (previousUrl) {
    const previousPath = pathFromPublicUrl(previousUrl);
    if (previousPath && previousPath !== path) {
      supabase.storage
        .from("avatars")
        .remove([previousPath])
        .catch((err) => console.error("Failed to remove previous avatar:", err));
    }
  }

  return avatarUrl;
}
