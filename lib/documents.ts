import { createClient } from "@/lib/supabase/client";

export interface DocumentRecord {
  id?: string;
  name: string;
  type: string;
  size: string;
  status: "Verified" | "Available" | "Pending Review";
  scope: "personal" | "company";
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  storageUrl: string;
  storagePath: string;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function fromRow(row: any): Omit<DocumentRecord, "storageUrl"> & { storagePath: string } {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    size: row.size,
    status: row.status,
    scope: row.scope,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    uploadedAt: row.uploaded_at,
    storagePath: row.storage_path,
  };
}

export const uploadDocument = async (
  file: File,
  userId: string,
  userName: string,
  scope: "personal" | "company"
): Promise<DocumentRecord> => {
  const supabase = createClient();
  const storagePath = `${scope}/${userId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file);
  if (uploadError) throw uploadError;

  const { data: signed } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
  const sizeStr =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      name: file.name,
      type: ext,
      size: sizeStr,
      status: "Pending Review",
      scope,
      uploaded_by: userId,
      uploaded_by_name: userName,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) throw error;

  return { ...fromRow(data), storageUrl: signed?.signedUrl || "" };
};

export const deleteDocument = async (docId: string, storagePath: string) => {
  const supabase = createClient();
  try {
    await supabase.storage.from("documents").remove([storagePath]);
  } catch {
    // File may not exist in storage
  }
  await supabase.from("documents").delete().eq("id", docId);
};

export const listenToDocuments = (
  userId: string,
  isAdmin: boolean,
  callback: (docs: DocumentRecord[]) => void
) => {
  const supabase = createClient();

  const fetchAndEmit = async () => {
    const { data, error } = await supabase.from("documents").select("*");
    if (error) {
      console.error("documents listener error:", error);
      return;
    }

    let records = (data || []).map(fromRow);

    if (!isAdmin) {
      records = records.filter((r) => r.scope === "company" || r.uploadedBy === userId);
    }

    records.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    const paths = records.map((r) => r.storagePath);
    let signedUrlMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signedList } = await supabase.storage
        .from("documents")
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      (signedList || []).forEach((s) => {
        if (s.signedUrl) signedUrlMap.set(s.path || "", s.signedUrl);
      });
    }

    callback(records.map((r) => ({ ...r, storageUrl: signedUrlMap.get(r.storagePath) || "" })));
  };

  fetchAndEmit();

  const channel = supabase
    .channel(`documents_${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, fetchAndEmit)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
