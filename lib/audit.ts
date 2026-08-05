import { db, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  addDoc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

export interface AuditLogEntry {
  id?: string;
  actorName: string;
  action: string;
  target: string;
  details?: string;
  createdAt: Timestamp;
}

export const logAuditEvent = async (
  actorName: string, // Kept for signature compatibility, but unused on server
  action: string,
  target: string,
  details?: string
): Promise<void> => {
  const logAuditFunc = httpsCallable(functions, 'logAudit');
  await logAuditFunc({ action, target, details });
};

export const listenToAuditLogs = (
  callback: (logs: AuditLogEntry[]) => void,
  maxItems: number = 100
) => {
  const q = collection(db, "audit_logs");

  return onSnapshot(q, (snapshot) => {
    const records: AuditLogEntry[] = [];
    snapshot.forEach((d) => {
      records.push({ id: d.id, ...d.data() } as AuditLogEntry);
    });

    // Sort newest first in JS to avoid composite index requirements
    records.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    callback(records.slice(0, maxItems));
  });
};
