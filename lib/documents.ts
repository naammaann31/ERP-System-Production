import { db, storage } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

export interface DocumentRecord {
  id?: string;
  name: string;
  type: string;
  size: string;
  status: "Verified" | "Available" | "Pending Review";
  scope: "personal" | "company";
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
  storageUrl: string;
  storagePath: string;
}

export const uploadDocument = async (
  file: File,
  userId: string,
  userName: string,
  scope: "personal" | "company"
): Promise<DocumentRecord> => {
  const storagePath = `documents/${scope}/${userId}_${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const storageUrl = await getDownloadURL(storageRef);

  const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
  const sizeStr =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  const docData: Omit<DocumentRecord, "id"> = {
    name: file.name,
    type: ext,
    size: sizeStr,
    status: "Pending Review",
    scope,
    uploadedBy: userId,
    uploadedByName: userName,
    uploadedAt: Timestamp.now(),
    storageUrl,
    storagePath,
  };

  const docRef = await addDoc(collection(db, "documents"), docData);
  return { id: docRef.id, ...docData };
};

export const deleteDocument = async (docId: string, storagePath: string) => {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (e) {
    // File may not exist in storage
  }
  await deleteDoc(doc(db, "documents", docId));
};

export const listenToDocuments = (
  userId: string,
  isAdmin: boolean,
  callback: (docs: DocumentRecord[]) => void
) => {
  const q = collection(db, "documents");

  return onSnapshot(q, (snapshot) => {
    let records: DocumentRecord[] = [];
    snapshot.forEach((d) => {
      records.push({ id: d.id, ...d.data() } as DocumentRecord);
    });

    // Filter: admins see all, employees see company docs + their own personal docs
    if (!isAdmin) {
      records = records.filter(
        (r) => r.scope === "company" || r.uploadedBy === userId
      );
    }

    // Sort by upload date, newest first
    records.sort((a, b) => {
      const aTime = a.uploadedAt?.toMillis ? a.uploadedAt.toMillis() : 0;
      const bTime = b.uploadedAt?.toMillis ? b.uploadedAt.toMillis() : 0;
      return bTime - aTime;
    });

    callback(records);
  });
};
