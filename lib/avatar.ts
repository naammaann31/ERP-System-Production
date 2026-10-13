import { createClient } from "@/lib/supabase/client";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Largest an Avatar is ever rendered at outside the Vectra Team lightbox
// (WelcomeHeader's h-28 override = 112px) is ~112px; 256px covers that with
// headroom for retina displays without the thumbnail itself becoming heavy.
const THUMB_MAX_DIMENSION = 256;
const THUMB_QUALITY = 0.85;

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
 * Resizes `file` down to THUMB_MAX_DIMENSION on its longest edge and
 * re-encodes it as a JPEG, client-side, via canvas — so the smaller file
 * is what actually gets uploaded, not just displayed smaller. GIFs are
 * deliberately skipped by the caller (drawing an animated GIF to canvas
 * only captures its first frame, killing the animation).
 */
async function createThumbnail(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, THUMB_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
        "image/jpeg",
        THUMB_QUALITY
      );
    });
  } finally {
    bitmap.close?.();
  }
}

/**
 * Uploads a new photo for `targetUid` and updates profiles.avatar_url /
 * avatar_thumb_url. Used both for self-upload (Settings) and Admin/HR
 * setting someone else's photo (Edit Employee) — RLS on the "avatars"
 * bucket and on profiles_update is what actually decides whether the
 * caller is allowed to do this for targetUid, this function just performs
 * the writes.
 *
 * Uploads both the original (kept for the Vectra Team lightbox's
 * click-to-enlarge view) and a small resized thumbnail (used for every
 * normal-sized display — table rows, navbar, widgets) so a 32px avatar
 * stops downloading the same multi-MB file as a full-screen view.
 */
export async function uploadAvatar(
  file: File,
  targetUid: string
): Promise<{ avatarUrl: string; avatarThumbUrl: string }> {
  validateFile(file);

  const supabase = createClient();

  // Looked up fresh (not passed in by the caller) so we always clean up
  // whatever is actually in the database right now, not a possibly-stale
  // value sitting in some component's local state.
  const { data: existingRow } = await supabase
    .from("profiles")
    .select("avatar_url, avatar_thumb_url")
    .eq("id", targetUid)
    .maybeSingle();
  const previousUrl = existingRow?.avatar_url as string | null | undefined;
  const previousThumbUrl = existingRow?.avatar_thumb_url as string | null | undefined;

  const ext = file.name.split(".").pop() || "jpg";
  const timestamp = Date.now();
  // Timestamped, so always a fresh path — no need for upsert (which, on
  // Supabase Storage, requires a SELECT policy to check for an existing
  // object first; this bucket intentionally has none, since it's public
  // and served via the public URL, not via authenticated table RLS).
  const path = `${targetUid}/${timestamp}.${ext}`;
  const thumbPath = `${targetUid}/${timestamp}_thumb.jpg`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
  if (uploadError) throw uploadError;

  // Thumbnail generation is a nice-to-have, not a hard requirement — if
  // the browser can't produce one (unsupported format, canvas error) or
  // the file is a GIF (resizing would kill the animation), fall back to
  // using the original as its own "thumbnail" rather than blocking the
  // upload the caller actually asked for.
  let thumbUploadPath = path;
  if (file.type !== "image/gif") {
    try {
      const thumbBlob = await createThumbnail(file);
      const { error: thumbUploadError } = await supabase.storage
        .from("avatars")
        .upload(thumbPath, thumbBlob, { contentType: "image/jpeg" });
      if (thumbUploadError) throw thumbUploadError;
      thumbUploadPath = thumbPath;
    } catch (err) {
      console.error("Avatar thumbnail generation failed, using original instead:", err);
      thumbUploadPath = path;
    }
  }

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = publicUrlData.publicUrl;
  const { data: thumbPublicUrlData } = supabase.storage.from("avatars").getPublicUrl(thumbUploadPath);
  const avatarThumbUrl = thumbPublicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl, avatar_thumb_url: avatarThumbUrl })
    .eq("id", targetUid);
  if (updateError) throw updateError;

  // Remove the previous photo(s) now that the new ones are confirmed live.
  // Best-effort and non-fatal: the upload itself already succeeded by this
  // point, so a failure here just leaves orphaned files rather than
  // breaking the operation the caller actually asked for.
  const pathsToRemove = Array.from(
    new Set(
      [previousUrl, previousThumbUrl]
        .map((url) => (url ? pathFromPublicUrl(url) : null))
        .filter((p): p is string => !!p && p !== path && p !== thumbUploadPath)
    )
  );
  if (pathsToRemove.length > 0) {
    supabase.storage
      .from("avatars")
      .remove(pathsToRemove)
      .catch((err) => console.error("Failed to remove previous avatar files:", err));
  }

  return { avatarUrl, avatarThumbUrl };
}
