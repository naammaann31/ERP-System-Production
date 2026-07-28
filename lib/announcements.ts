import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";

export interface Announcement {
  id?: string;
  title: string;
  body: string;
  author: string;
  authorName: string;
  pinned: boolean;
  archived: boolean;
  createdAt: Timestamp;
}

export const createAnnouncement = async (
  title: string,
  body: string,
  authorUid: string,
  authorName: string,
  pinned: boolean = false
): Promise<Announcement> => {
  const data: Omit<Announcement, "id"> = {
    title,
    body,
    author: authorUid,
    authorName,
    pinned,
    archived: false,
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, "announcements"), data);
  return { id: docRef.id, ...data };
};

export const togglePinAnnouncement = async (id: string, pinned: boolean) => {
  await updateDoc(doc(db, "announcements", id), { pinned });
};

export const archiveAnnouncement = async (id: string) => {
  await updateDoc(doc(db, "announcements", id), { archived: true });
};

export const deleteAnnouncement = async (id: string) => {
  await deleteDoc(doc(db, "announcements", id));
};

export const listenToAnnouncements = (
  callback: (announcements: Announcement[]) => void
) => {
  const q = collection(db, "announcements");

  return onSnapshot(q, (snapshot) => {
    let records: Announcement[] = [];
    snapshot.forEach((d) => {
      records.push({ id: d.id, ...d.data() } as Announcement);
    });

    // Filter out archived
    records = records.filter((r) => !r.archived);

    // Sort: pinned first, then by date
    records.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    callback(records);
  });
};
