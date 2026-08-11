import { createClient } from "@/lib/supabase/client";
import { createNotification } from "./notifications";

export interface Announcement {
  id?: string;
  title: string;
  body: string;
  author: string;
  authorName: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
}

function fromRow(row: any): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    author: row.author,
    authorName: row.author_name,
    pinned: row.pinned,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

export const createAnnouncement = async (
  title: string,
  body: string,
  authorUid: string,
  authorName: string,
  pinned: boolean = false
): Promise<Announcement> => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("announcements")
    .insert({ title, body, author: authorUid, author_name: authorName, pinned, archived: false })
    .select()
    .single();

  if (error) throw error;

  // Notify all other users in the system
  try {
    const { data: profiles } = await supabase.from("profiles").select("id");
    const otherIds = (profiles || []).map((p) => p.id).filter((id) => id !== authorUid);
    await Promise.all(
      otherIds.map((uid) => createNotification(uid, `New Announcement: ${title}`, "announcement"))
    );
  } catch (err) {
    console.error("Failed to distribute announcement notifications:", err);
  }

  return fromRow(data);
};

export const togglePinAnnouncement = async (id: string, pinned: boolean) => {
  const supabase = createClient();
  await supabase.from("announcements").update({ pinned }).eq("id", id);
};

export const archiveAnnouncement = async (id: string) => {
  const supabase = createClient();
  await supabase.from("announcements").update({ archived: true }).eq("id", id);
};

export const deleteAnnouncement = async (id: string) => {
  const supabase = createClient();
  await supabase.from("announcements").delete().eq("id", id);
};

export const listenToAnnouncements = (callback: (announcements: Announcement[]) => void) => {
  const supabase = createClient();

  const fetchAndEmit = async () => {
    const { data, error } = await supabase.from("announcements").select("*");
    if (error) {
      console.error("announcements listener error:", error);
      return;
    }

    let records = (data || []).map(fromRow).filter((r) => !r.archived);

    records.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    callback(records);
  };

  fetchAndEmit();

  const channel = supabase
    .channel(`announcements_${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, fetchAndEmit)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
