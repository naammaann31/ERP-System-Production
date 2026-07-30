import { db } from "./firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

export interface UserSettings {
  fullName?: string;
  phone?: string;
  timezone?: string;
  notificationsEmail?: boolean;
  notificationsLeave?: boolean;
  notificationsPayroll?: boolean;
}

export const updateUserProfile = async (uid: string, data: UserSettings) => {
  // Try 'users' first, fallback to 'Users'
  const docRef1 = doc(db, "users", uid);
  const snap1 = await getDoc(docRef1);

  if (snap1.exists()) {
    await updateDoc(docRef1, { ...data });
    return;
  }

  const docRef2 = doc(db, "Users", uid);
  const snap2 = await getDoc(docRef2);

  if (snap2.exists()) {
    await updateDoc(docRef2, { ...data });
    return;
  }

  throw new Error("User document not found");
};

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
  let docRef = doc(db, "users", uid);
  let snap = await getDoc(docRef);

  if (!snap.exists()) {
    docRef = doc(db, "Users", uid);
    snap = await getDoc(docRef);
  }

  if (snap.exists()) {
    const data = snap.data();
    return {
      fullName: data.fullName,
      phone: data.phone || "",
      timezone: data.timezone || "Asia/Kolkata",
      notificationsEmail: data.notificationsEmail ?? true,
      notificationsLeave: data.notificationsLeave ?? true,
      notificationsPayroll: data.notificationsPayroll ?? true,
    };
  }

  return {};
};
