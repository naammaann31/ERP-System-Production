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
  getDocs,
  writeBatch,
} from "firebase/firestore";

export interface OnboardingTask {
  id?: string;
  employeeUid: string;
  employeeName: string;
  taskName: string;
  completed: boolean;
  dueDate?: string;
  createdAt: Timestamp;
}

const DEFAULT_TASKS = [
  "Submit Government ID Copy",
  "Sign Non-Disclosure Agreement (NDA)",
  "Complete Tax Declaration Form",
  "Provide Emergency Contact Details",
  "Submit Bank Account Details",
  "Acknowledge Employee Handbook",
];

export const createOnboardingForEmployee = async (
  employeeUid: string,
  employeeName: string
) => {
  const batch = writeBatch(db);

  for (const taskName of DEFAULT_TASKS) {
    const docRef = doc(collection(db, "onboarding_tasks"));
    batch.set(docRef, {
      employeeUid,
      employeeName,
      taskName,
      completed: false,
      createdAt: Timestamp.now(),
    });
  }

  await batch.commit();
};

export const toggleOnboardingTask = async (
  taskId: string,
  completed: boolean
) => {
  await updateDoc(doc(db, "onboarding_tasks", taskId), { completed });
};

export const listenToEmployeeOnboarding = (
  employeeUid: string,
  callback: (tasks: OnboardingTask[]) => void
) => {
  const q = query(
    collection(db, "onboarding_tasks"),
    where("employeeUid", "==", employeeUid)
  );

  return onSnapshot(q, (snapshot) => {
    const records: OnboardingTask[] = [];
    snapshot.forEach((d) => {
      records.push({ id: d.id, ...d.data() } as OnboardingTask);
    });
    records.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return aTime - bTime;
    });
    callback(records);
  });
};

export const listenToAllOnboarding = (
  callback: (tasks: OnboardingTask[]) => void
) => {
  const q = collection(db, "onboarding_tasks");

  return onSnapshot(q, (snapshot) => {
    const records: OnboardingTask[] = [];
    snapshot.forEach((d) => {
      records.push({ id: d.id, ...d.data() } as OnboardingTask);
    });
    callback(records);
  });
};
