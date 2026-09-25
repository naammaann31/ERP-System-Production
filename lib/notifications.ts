import { createClient } from "@/lib/supabase/client";

export interface Notification {
  id?: string;
  userId: string;
  message: string;
  type: "payroll" | "leave" | "announcement" | "general";
  read: boolean;
  createdAt: string;
}

function fromRow(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    message: row.message,
    type: row.type,
    read: row.read,
    createdAt: row.created_at,
  };
}

export const createNotification = async (
  userId: string,
  message: string,
  type: Notification["type"] = "general"
): Promise<Notification> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id: userId, message, type, read: false })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
};

export const markAsRead = async (notificationId: string) => {
  const supabase = createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
};

export const markAllAsRead = async (userId: string) => {
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
};

export const markTypeAsRead = async (userId: string, type: Notification["type"]) => {
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("type", type)
    .eq("read", false);
};

export const listenToUserNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
) => {
  const supabase = createClient();

  let currentData: Notification[] = [];

  const fetchAndEmit = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("notifications listener error:", error);
      return;
    }
    currentData = (data || []).map(fromRow);
    callback(currentData);
  };

  fetchAndEmit();

  const channel = supabase
    .channel(`notifications_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          currentData = currentData.filter((n) => n.id !== payload.old.id);
        } else if (payload.eventType === "INSERT") {
          currentData = [fromRow(payload.new as any), ...currentData];
        } else if (payload.eventType === "UPDATE") {
          const updatedRow = fromRow(payload.new as any);
          const idx = currentData.findIndex((n) => n.id === updatedRow.id);
          if (idx !== -1) {
            currentData[idx] = updatedRow;
          } else {
            currentData = [updatedRow, ...currentData];
          }
        }
        callback([...currentData]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
