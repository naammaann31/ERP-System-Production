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
  jobRole?: string;
  department?: string;
  dateOfJoining?: string;
  bankName?: string;
  division?: string;
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
  incentives: number;

  totalEarnings: number;

  // Deductions
  lopDays: number;
  lopDeduction: number;
  taxDeduction: number; // Professional Tax
  incomeTax: number;
  providentFund: number;
  otherDeductions: number;

  totalDeductions: number;

  // Final
  netSalary: number;

  paymentDate?: string;
  modeOfPayment?: string;

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
export const calculateSalaryBreakup = (gross: number, travel: number, lopDays: number, daysInMonth: number, otherDeds = 0, otherAlls = 0, incentives = 0, professionalTax = 200, incomeTax = 0, providentFund = 0) => {
  const basic = gross * 0.5;
  const hra = gross * 0.2;
  const specialAllowance = Math.max(0, gross - basic - hra - travel);

  const totalEarnings = gross + otherAlls + incentives;

  const perDaySalary = gross / daysInMonth; // Per Day Salary = Gross Salary ÷ Total Days
  const lopDeduction = Number((perDaySalary * lopDays).toFixed(2));

  const totalDeductions = lopDeduction + professionalTax + incomeTax + providentFund + otherDeds;
  const netSalary = totalEarnings - totalDeductions;

  return {
    grossSalary: gross,
    basic,
    hra,
    travelAllowance: travel,
    specialAllowance,
    otherAllowances: otherAlls,
    incentives,
    totalEarnings,
    lopDays,
    lopDeduction,
    taxDeduction: professionalTax,
    incomeTax,
    providentFund,
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
  jobRole?: string,
  department?: string,
  dateOfJoining?: string,
  bankName?: string,
  division?: string,
  professionalTax: number = 200,
  incomeTax: number = 0,
  providentFund: number = 0,
  incentives: number = 0,
  paymentDate?: string,
  modeOfPayment?: string
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
    structure.otherAllowances,
    incentives,
    professionalTax,
    incomeTax,
    providentFund
  );

  const daysWorked = daysInMonth - lopDays;

  const docId = `${userId}_${year}_${month}`;
  const docRef = doc(db, "payrolls", docId);

  const record: PayrollRecord = {
    userId,
    employeeName,
    employeeId: employeeId || "",
    jobRole: jobRole || "",
    department: department || "",
    dateOfJoining: dateOfJoining || "",
    bankName: bankName || "",
    division: division || "",
    daysWorked,
    month,
    year,
    ...breakup,
    paymentDate: paymentDate || "",
    modeOfPayment: modeOfPayment || "Bank Transfer",
    generatedAt: Timestamp.now(),
    status: "Pending"
  };

  await setDoc(docRef, record);
  return { id: docId, ...record };
};

export const getEmployeePayrolls = async (userId: string, fullName?: string, employeeId?: string): Promise<PayrollRecord[]> => {
  const q = collection(db, "payrolls");
  const querySnapshot = await getDocs(q);
  const records: PayrollRecord[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data() as PayrollRecord;
    const matchUser = data.userId === userId ||
      (fullName && data.employeeName?.toLowerCase() === fullName.toLowerCase()) ||
      (employeeId && data.employeeId === employeeId);

    if (matchUser) {
      records.push({ id: doc.id, ...data });
    }
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
