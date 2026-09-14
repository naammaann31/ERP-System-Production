import { createClient } from "@/lib/supabase/client";
import { getUserLeaves } from "@/lib/leave";

export interface SalaryStructure {
  userId: string;
  grossSalary: number;
  travelAllowance: number;
  otherDeductions: number;
  otherAllowances: number;
  updatedAt: string;
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

  grossSalary: number;
  basic: number;
  hra: number;
  travelAllowance: number;
  specialAllowance: number;
  otherAllowances: number;
  incentives: number;

  totalEarnings: number;

  lopDays: number;
  lopDeduction: number;
  taxDeduction: number;
  incomeTax: number;
  providentFund: number;
  otherDeductions: number;

  totalDeductions: number;

  netSalary: number;

  paymentDate?: string;
  modeOfPayment?: string;

  generatedAt: string;
  status: "Paid" | "Pending";
}

function structureFromRow(row: any): SalaryStructure {
  return {
    userId: row.user_id,
    grossSalary: row.gross_salary,
    travelAllowance: row.travel_allowance,
    otherDeductions: row.other_deductions,
    otherAllowances: row.other_allowances,
    updatedAt: row.updated_at,
  };
}

function payrollFromRow(row: any): PayrollRecord {
  return {
    id: row.id,
    userId: row.user_id,
    employeeName: row.employee_name,
    employeeId: row.employee_id,
    jobRole: row.job_role,
    department: row.department,
    dateOfJoining: row.date_of_joining,
    bankName: row.bank_name,
    division: row.division,
    daysWorked: row.days_worked,
    month: row.month,
    year: row.year,
    grossSalary: row.gross_salary,
    basic: row.basic,
    hra: row.hra,
    travelAllowance: row.travel_allowance,
    specialAllowance: row.special_allowance,
    otherAllowances: row.other_allowances,
    incentives: row.incentives,
    totalEarnings: row.total_earnings,
    lopDays: row.lop_days,
    lopDeduction: row.lop_deduction,
    taxDeduction: row.tax_deduction,
    incomeTax: row.income_tax,
    providentFund: row.provident_fund,
    otherDeductions: row.other_deductions,
    totalDeductions: row.total_deductions,
    netSalary: row.net_salary,
    paymentDate: row.payment_date,
    modeOfPayment: row.mode_of_payment,
    generatedAt: row.generated_at,
    status: row.status,
  };
}

export const saveSalaryStructure = async (
  userId: string,
  data: Omit<SalaryStructure, "userId" | "updatedAt">
) => {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("salary_structures")
    .upsert({
      user_id: userId,
      gross_salary: data.grossSalary,
      travel_allowance: data.travelAllowance,
      other_deductions: data.otherDeductions,
      other_allowances: data.otherAllowances,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return structureFromRow(row);
};

export const getSalaryStructure = async (userId: string): Promise<SalaryStructure | null> => {
  const supabase = createClient();
  const { data } = await supabase
    .from("salary_structures")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data ? structureFromRow(data) : null;
};

// Pure calculation logic (client-side preview only — the server-side
// generate_payroll() RPC recomputes this authoritatively)
export const calculateSalaryBreakup = (
  gross: number,
  travel: number,
  lopDays: number,
  daysInMonth: number,
  otherDeds = 0,
  otherAlls = 0,
  incentives = 0,
  professionalTax = 200,
  incomeTax = 0,
  providentFund = 0
) => {
  const basic = gross * 0.5;
  const hra = gross * 0.2;
  const specialAllowance = Math.max(0, gross - basic - hra - travel);

  const totalEarnings = gross + otherAlls + incentives;

  const perDaySalary = gross / daysInMonth;
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
    netSalary: Number(netSalary.toFixed(2)),
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
  const supabase = createClient();
  const { data, error } = await supabase.rpc("generate_payroll", {
    p_employee_uid: userId,
    p_month: month,
    p_year: year,
    p_lop_days: lopDays,
    p_professional_tax: professionalTax,
    p_income_tax: incomeTax,
    p_provident_fund: providentFund,
    p_incentives: incentives,
    p_payment_date: paymentDate || null,
    p_mode_of_payment: modeOfPayment || "Bank Transfer",
  });

  if (error) throw error;
  return payrollFromRow(data);
};

export const getEmployeePayrolls = async (userId: string): Promise<PayrollRecord[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payrolls")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) throw error;
  return (data || []).map(payrollFromRow);
};

export const getAllPayrolls = async (): Promise<PayrollRecord[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payrolls")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) throw error;
  return (data || []).map(payrollFromRow);
};

export const deletePayroll = async (payrollId: string): Promise<void> => {
  const supabase = createClient();
  const { error } = await supabase.from("payrolls").delete().eq("id", payrollId);
  if (error) throw error;
}

export async function calculateEmployeeLopAndLeaves(
  employeeUid: string,
  month: number,
  year: number,
  dateOfJoining: string | undefined
): Promise<{ lopDays: number, leavesTakenThisMonth: number, paidLeavesThisMonth: number }> {
  const leaves = await getUserLeaves(employeeUid);

  // Filter for approved leaves in the selected year
  const yearLeaves = leaves.filter(l => {
    const start = new Date(l.startDate);
    return start.getFullYear() === year && l.status === "Approved";
  });

  const leaveMap = new Map<string, number>();
  yearLeaves.forEach(l => {
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    let curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const currentVal = leaveMap.get(dateStr) || 0;
      const dayVal = (l.days === 0.5 && start.getTime() === end.getTime()) ? 0.5 : 1;
      leaveMap.set(dateStr, Math.min(1, currentVal + dayVal));
      curr.setDate(curr.getDate() + 1);
    }
  });

  // Apply Sandwich Rule
  const dates = Array.from(leaveMap.keys()).sort();
  dates.forEach(dateStr => {
    const d = new Date(dateStr);
    if (d.getDay() === 5) { // Friday
      const nextMonday = new Date(d);
      nextMonday.setDate(d.getDate() + 3);
      const mondayStr = nextMonday.toISOString().split('T')[0];

      if (leaveMap.has(mondayStr)) {
        // Sandwich! Add Saturday and Sunday
        const sat = new Date(d); sat.setDate(d.getDate() + 1);
        const sun = new Date(d); sun.setDate(d.getDate() + 2);
        leaveMap.set(sat.toISOString().split('T')[0], 1);
        leaveMap.set(sun.toISOString().split('T')[0], 1);
      }
    }
  });

  let totalLeavesTakenBeforeMonth = 0;
  let leavesTakenInMonth = 0;

  leaveMap.forEach((val, dateStr) => {
    const d = new Date(dateStr);
    if (d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() + 1 < month)) {
      totalLeavesTakenBeforeMonth += val;
    } else if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      leavesTakenInMonth += val;
    }
  });

  const calculateAccrued = () => {
    if (!dateOfJoining) return 2; // Default 2 for 1st month
    const joinDate = new Date(dateOfJoining);
    if (isNaN(joinDate.getTime())) return 2;

    const targetDate = new Date(year, month - 1, 1);

    // If they are generating payroll for a month BEFORE they joined
    if (targetDate < joinDate) return 0;

    const yearsDiff = targetDate.getFullYear() - joinDate.getFullYear();
    const monthsDiff = targetDate.getMonth() - joinDate.getMonth();
    const totalMonths = (yearsDiff * 12) + monthsDiff;
    return Math.max(1, totalMonths + 1) * 2;
  };

  const totalAccruedUpToMonth = calculateAccrued();
  const availableBalanceAtStartOfMonth = Math.max(0, totalAccruedUpToMonth - totalLeavesTakenBeforeMonth);

  // If they took more leaves in this month than their available balance, the rest is LOP
  const unpaidLeaves = Math.max(0, leavesTakenInMonth - availableBalanceAtStartOfMonth);

  return {
    lopDays: unpaidLeaves,
    leavesTakenThisMonth: leavesTakenInMonth,
    paidLeavesThisMonth: Math.min(leavesTakenInMonth, availableBalanceAtStartOfMonth)
  };
};
