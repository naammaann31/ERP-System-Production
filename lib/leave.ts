import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  Timestamp,
  orderBy,
  addDoc,
  onSnapshot
} from "firebase/firestore";

export interface LeaveRequest {
  id?: string;
  userId: string;
  fullName: string;
  department: string;
  role?: string;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  appliedOn: Timestamp;
}

export const applyLeave = async (
  userId: string, 
  fullName: string, 
  department: string, 
  leaveType: string, 
  startDate: string, 
  endDate: string, 
  days: number, 
  reason: string,
  role?: string
) => {
  const newLeave: any = {
    userId,
    fullName,
    department,
    leaveType,
    startDate,
    endDate,
    days,
    reason,
    status: "Pending",
    appliedOn: Timestamp.now(),
  };

  if (role) {
    newLeave.role = role;
  }

  const docRef = await addDoc(collection(db, "leave_requests"), newLeave);
  return { id: docRef.id, ...newLeave } as LeaveRequest;
};

export const getUserLeaves = async (userId: string) => {
  const q = query(
    collection(db, "leave_requests"), 
    where("userId", "==", userId)
  );
  
  const querySnapshot = await getDocs(q);
  let records: LeaveRequest[] = [];
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as LeaveRequest);
  });
  
  // Sort descending by appliedOn
  records.sort((a, b) => {
    const aTime = a.appliedOn?.toMillis ? a.appliedOn.toMillis() : 0;
    const bTime = b.appliedOn?.toMillis ? b.appliedOn.toMillis() : 0;
    return bTime - aTime;
  });
  
  return records;
};

export const getAllPendingLeaves = async () => {
  const q = query(
    collection(db, "leave_requests"), 
    where("status", "==", "Pending")
  );
  
  const querySnapshot = await getDocs(q);
  let records: LeaveRequest[] = [];
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as LeaveRequest);
  });
  
  // Sort descending by appliedOn
  records.sort((a, b) => {
    const aTime = a.appliedOn?.toMillis ? a.appliedOn.toMillis() : 0;
    const bTime = b.appliedOn?.toMillis ? b.appliedOn.toMillis() : 0;
    return bTime - aTime;
  });
  
  return records;
};

export const updateLeaveStatus = async (leaveId: string, status: "Approved" | "Rejected") => {
  const docRef = doc(db, "leave_requests", leaveId);
  await updateDoc(docRef, { status });
};

export const listenToUserLeaves = (userId: string, callback: (leaves: LeaveRequest[]) => void) => {
  const q = query(
    collection(db, "leave_requests"), 
    where("userId", "==", userId)
  );
  
  return onSnapshot(q, (querySnapshot) => {
    let records: LeaveRequest[] = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as LeaveRequest);
    });
    records.sort((a, b) => {
      const aTime = a.appliedOn?.toMillis ? a.appliedOn.toMillis() : 0;
      const bTime = b.appliedOn?.toMillis ? b.appliedOn.toMillis() : 0;
      return bTime - aTime;
    });
    callback(records);
  }, (error) => {
    console.error("listenToUserLeaves error: ", error);
  });
};

export const listenToPendingLeaves = (callback: (leaves: LeaveRequest[]) => void) => {
  const q = query(
    collection(db, "leave_requests"), 
    where("status", "==", "Pending")
  );
  
  return onSnapshot(q, (querySnapshot) => {
    let records: LeaveRequest[] = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as LeaveRequest);
    });
    records.sort((a, b) => {
      const aTime = a.appliedOn?.toMillis ? a.appliedOn.toMillis() : 0;
      const bTime = b.appliedOn?.toMillis ? b.appliedOn.toMillis() : 0;
      return bTime - aTime;
    });
    callback(records);
  }, (error) => { if (error.code !== 'permission-denied') console.error(error); });
};

export const listenToAllLeaves = (callback: (leaves: LeaveRequest[]) => void) => {
  const q = collection(db, "leave_requests");
  
  return onSnapshot(q, (querySnapshot) => {
    let records: LeaveRequest[] = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as LeaveRequest);
    });
    records.sort((a, b) => {
      const aTime = a.appliedOn?.toMillis ? a.appliedOn.toMillis() : 0;
      const bTime = b.appliedOn?.toMillis ? b.appliedOn.toMillis() : 0;
      return bTime - aTime;
    });
    callback(records);
  }, (error) => { if (error.code !== 'permission-denied') console.error(error); });
};
