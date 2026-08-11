import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  getDocs,
  Timestamp,
  orderBy
} from "firebase/firestore";

export interface AttendanceRecord {
  id?: string;
  userId: string;
  fullName: string;
  role?: string;
  date: string; // YYYY-MM-DD
  checkInTime: Timestamp | null;
  checkOutTime: Timestamp | null;
  status: "Present" | "Checked In" | "Absent" | "On Leave" | "Week Off";
  workingSeconds: number;
}

export const getLocalDateString = () => {
  const now = new Date();
  
  // The shift starts at 7:30 PM (19:30).
  // Any time before 7:30 PM belongs to the previous calendar day's shift.
  // This ensures the shift resets exactly at 7:30 PM every day.
  if (now.getHours() < 19 || (now.getHours() === 19 && now.getMinutes() < 30)) {
    now.setDate(now.getDate() - 1);
  }
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const checkIn = async (userId: string, fullName: string, role?: string) => {
  const dateStr = getLocalDateString();
  const docId = `${userId}_${dateStr}`;
  const docRef = doc(db, "attendance", docId);
  
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as AttendanceRecord;
  }

  const newRecord: any = {
    userId,
    fullName,
    date: dateStr,
    checkInTime: Timestamp.now(),
    checkOutTime: null,
    status: "Checked In",
    workingSeconds: 0,
  };
  
  if (role) {
    newRecord.role = role;
  }

  await setDoc(docRef, newRecord);
  return { id: docId, ...newRecord } as AttendanceRecord;
};

export const updateWorkingSeconds = async (docId: string, workingSeconds: number) => {
  const docRef = doc(db, "attendance", docId);
  await updateDoc(docRef, { workingSeconds });
};

export const checkOut = async (docId: string, workingSeconds: number) => {
  const docRef = doc(db, "attendance", docId);
  await updateDoc(docRef, {
    checkOutTime: Timestamp.now(),
    status: "Present",
    workingSeconds,
  });
};

export const getTodayAttendance = async (userId: string) => {
  const dateStr = getLocalDateString();
  const docId = `${userId}_${dateStr}`;
  const docRef = doc(db, "attendance", docId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as AttendanceRecord;
  }
  return null;
};

export const getAllTodayAttendance = async () => {
  const dateStr = getLocalDateString();
  const q = query(collection(db, "attendance"), where("date", "==", dateStr));
  const querySnapshot = await getDocs(q);
  
  const records: AttendanceRecord[] = [];
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
  });
  
  return records;
};

export const getAttendanceByDate = async (dateStr: string) => {
  const q = query(collection(db, "attendance"), where("date", "==", dateStr));
  const querySnapshot = await getDocs(q);
  
  const records: AttendanceRecord[] = [];
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
  });
  
  return records;
};

export const getUserAttendanceForMonth = async (userId: string, yearMonth: string) => {
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-31`;
  
  const q = query(
    collection(db, "attendance"), 
    where("userId", "==", userId)
  );
  
  const querySnapshot = await getDocs(q);
  let records: AttendanceRecord[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data() as AttendanceRecord;
    if (data.date >= startDate && data.date <= endDate) {
      records.push({ id: doc.id, ...data });
    }
  });
  
  // Sort descending by date
  records.sort((a, b) => b.date.localeCompare(a.date));
  
  return records;
};
