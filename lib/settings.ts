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
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    await updateDoc(docRef, { ...data });
    return;
  }

  throw new Error("User document not found");
};

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);

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
