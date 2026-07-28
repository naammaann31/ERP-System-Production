import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  query, 
  where, 
  getDocs,
  Timestamp,
  orderBy
} from "firebase/firestore";

export interface SalaryStructure {
  userId: string;
  grossSalary: number;
  travelAllowance: number;
  otherDeductions: number;
  otherAllowances: number;
  updatedAt: Timestamp;
}

export interface PayrollRecord {
  id?: string;
  userId: string;
  employeeName: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  daysWorked?: number;
  month: number;
  year: number;
  
  // Breakup
  grossSalary: number;
  basic: number;
  hra: number;
  travelAllowance: number;
  specialAllowance: number;
  otherAllowances: number;
  
  totalEarnings: number;
  
  // Deductions
  lopDays: number;
  lopDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  
  totalDeductions: number;
  
  // Final
  netSalary: number;
  
  generatedAt: Timestamp;
  status: "Paid" | "Pending";
}

const FIXED_TAX = 200;

export const saveSalaryStructure = async (userId: string, data: Omit<SalaryStructure, 'userId' | 'updatedAt'>) => {
  const docRef = doc(db, "salary_structures", userId);
  const structure: SalaryStructure = {
    userId,
    ...data,
    updatedAt: Timestamp.now()
  };
  await setDoc(docRef, structure);
  return structure;
};

export const getSalaryStructure = async (userId: string): Promise<SalaryStructure | null> => {
  const docRef = doc(db, "salary_structures", userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as SalaryStructure;
  }
  return null;
};

// Pure calculation logic
export const calculateSalaryBreakup = (gross: number, travel: number, lopDays: number, daysInMonth: number, otherDeds = 0, otherAlls = 0) => {
  const basic = gross * 0.5;
  const hra = gross * 0.2;
  const specialAllowance = Math.max(0, gross - basic - hra - travel);
  
  const totalEarnings = gross + otherAlls;
  
  const perDaySalary = gross / daysInMonth; // Per Day Salary = Gross Salary ÷ Total Days
  const lopDeduction = Number((perDaySalary * lopDays).toFixed(2));
  
  const totalDeductions = lopDeduction + FIXED_TAX + otherDeds;
  const netSalary = totalEarnings - totalDeductions;
  
  return {
    grossSalary: gross,
    basic,
    hra,
    travelAllowance: travel,
    specialAllowance,
    otherAllowances: otherAlls,
    totalEarnings,
    lopDays,
    lopDeduction,
    taxDeduction: FIXED_TAX,
    otherDeductions: otherDeds,
    totalDeductions: Number(totalDeductions.toFixed(2)),
    netSalary: Number(netSalary.toFixed(2))
  };
};

export const generatePayroll = async (
  userId: string, 
  employeeName: string, 
  month: number, 
  year: number, 
  lopDays: number, 
  daysInMonth: number,
  employeeId?: string,
  designation?: string,
  department?: string
): Promise<PayrollRecord> => {
  const structure = await getSalaryStructure(userId);
  if (!structure) {
    throw new Error("Salary structure not found for employee");
  }

  const breakup = calculateSalaryBreakup(
    structure.grossSalary, 
    structure.travelAllowance, 
    lopDays, 
    daysInMonth,
    structure.otherDeductions,
    structure.otherAllowances
  );

  const daysWorked = daysInMonth - lopDays;

  const docId = `${userId}_${year}_${month}`;
  const docRef = doc(db, "payrolls", docId);
  
  const record: PayrollRecord = {
    userId,
    employeeName,
    employeeId: employeeId || "",
    designation: designation || "",
    department: department || "",
    daysWorked,
    month,
    year,
    ...breakup,
    generatedAt: Timestamp.now(),
    status: "Pending"
  };

  await setDoc(docRef, record);
  return { id: docId, ...record };
};

export const getEmployeePayrolls = async (userId: string): Promise<PayrollRecord[]> => {
  const q = query(
    collection(db, "payrolls"), 
    where("userId", "==", userId)
  );
  
  const querySnapshot = await getDocs(q);
  const records: PayrollRecord[] = [];
  
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as PayrollRecord);
  });
  
  // Sort in JS to avoid Firebase Index errors
  records.sort((a, b) => b.year - a.year || b.month - a.month);
  
  return records;
};

export const getAllPayrolls = async (): Promise<PayrollRecord[]> => {
  const q = query(collection(db, "payrolls"));
  
  const querySnapshot = await getDocs(q);
  const records: PayrollRecord[] = [];
  
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as PayrollRecord);
  });
  
  // Sort in JS to avoid Firebase Index errors
  records.sort((a, b) => b.year - a.year || b.month - a.month);
  
  return records;
};

export const deletePayroll = async (payrollId: string): Promise<void> => {
  const docRef = doc(db, "payrolls", payrollId);
  await deleteDoc(docRef);
};
