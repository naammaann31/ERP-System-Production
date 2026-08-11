import { createClient } from "@/lib/supabase/client";

export interface AuditLogEntry {
  id?: string;
  actorName: string;
  action: string;
  target: string;
  details?: string;
  createdAt: string;
}

function fromRow(row: any): AuditLogEntry {
  return {
    id: row.id,
    actorName: row.actor_name,
    action: row.action,
    target: row.target,
    details: row.details,
    createdAt: row.created_at,
  };
}

export const logAuditEvent = async (
  actorName: string, // Kept for signature compatibility, but unused — the RPC reads the actor's name server-side
  action: string,
  target: string,
  details?: string
): Promise<void> => {
  const supabase = createClient();
  const { error } = await supabase.rpc("log_audit", {
    p_action: action,
    p_target: target,
    p_details: details || null,
  });
  if (error) throw error;
};

export const listenToAuditLogs = (
  callback: (logs: AuditLogEntry[]) => void,
  maxItems: number = 100
) => {
  const supabase = createClient();

  const fetchAndEmit = async () => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(maxItems);

    if (error) {
      console.error("audit_logs listener error:", error);
      return;
    }
    callback((data || []).map(fromRow));
  };

  fetchAndEmit();

  const channel = supabase
    .channel(`audit_logs_${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, fetchAndEmit)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
