import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  Timestamp,
  query,
  where,
} from "firebase/firestore";

export interface Notification {
  id?: string;
  userId: string;
  message: string;
  type: "payroll" | "leave" | "announcement" | "general";
  read: boolean;
  createdAt: Timestamp;
}

export const createNotification = async (
  userId: string,
  message: string,
  type: Notification["type"] = "general"
): Promise<Notification> => {
  const data: Omit<Notification, "id"> = {
    userId,
    message,
    type,
    read: false,
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, "notifications"), data);
  return { id: docRef.id, ...data };
};

export const markAsRead = async (notificationId: string) => {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
};

export const markAllAsRead = async (userId: string) => {
  // Listen once and mark all
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read", "==", false)
  );

  const { getDocs } = await import("firebase/firestore");
  const snapshot = await getDocs(q);

  const promises: Promise<void>[] = [];
  snapshot.forEach((d) => {
    promises.push(updateDoc(doc(db, "notifications", d.id), { read: true }));
  });
  await Promise.all(promises);
};

export const listenToUserNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
) => {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const records: Notification[] = [];
    snapshot.forEach((d) => {
      records.push({ id: d.id, ...d.data() } as Notification);
    });

    // Sort newest first
    records.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    callback(records);
  });
};
