import { createClient } from "@/lib/supabase/client";
import { getUserLeaves, getElClWindow, computeCategoryMonthUsage, dateOnlyToLocalDate } from "@/lib/leave";
import { getShifts, legacyIsImmigration } from "@/lib/shifts";
import { isWeekOffForRule, isImmigrationWeekOffDate } from "@/lib/attendanceRules";
import { getUsHolidayName } from "@/lib/holidays";

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

// The day-by-day leave-map + Sandwich Rule + balance-exhaustion math used
// to live here as a private copy. It's now computeCategoryMonthUsage() in
// lib/leave.ts - shared with the new Attendance EL/CL badges, so the two
// screens can never disagree about which days are Paid vs LOP. See that
// file for the full explanation.

/**
 * For a day with NO attendance row at all, decides whether it would be
 * displayed as "Absent" in the Attendance screen's own placeholder logic
 * (HRAttendanceDashboard.tsx's mergedRecords builder) - Holiday and Week
 * Off placeholders are never Absent, everything else is. Reusing the exact
 * same two checks (getUsHolidayName, then the shift's own week-off rule,
 * falling back to the plain Sun/Sat or Immigration Sun+last-Saturday rule
 * when a profile has no matching shift row) so payroll's "was this day
 * really an unrecorded absence" answer can never disagree with what HR
 * already sees on the Attendance tab for that same day.
 */
function isUnrecordedDayAnAbsence(
  dateStr: string,
  year: number,
  month1Indexed: number,
  day: number,
  shift: { weekOffRule: "standard_weekend" | "sunday_plus_last_saturday" } | undefined,
  isImmigration: boolean
): boolean {
  if (getUsHolidayName(dateStr)) return false;

  const isWeekOff = shift
    ? isWeekOffForRule(shift.weekOffRule, year, month1Indexed, day)
    : isImmigration
    ? isImmigrationWeekOffDate(year, month1Indexed, day)
    : (() => {
        const d = new Date(Date.UTC(year, month1Indexed - 1, day));
        const dow = d.getUTCDay();
        return dow === 0 || dow === 6;
      })();
  if (isWeekOff) return false;

  return true;
}

// Category-aware LOP: Earned Leave and Casual Leave are each tracked and
// exhausted independently (a shortfall in one category is real LOP even if
// the other still has balance — the category an employee picks when
// applying for leave has real payroll consequences, by design), then
// summed. Uses lib/leave.ts's getElClWindow() so this can never silently
// disagree with the Leave Balance display about accrual months or window
// boundaries, and reads the same one-time opening-balance columns
// (profiles.el_opening_balance/cl_opening_balance) the Leave Balance
// display reads — never a Manual Credit/Deduction row.
export async function calculateEmployeeLopAndLeaves(
  employeeUid: string,
  month: number,
  year: number,
  dateOfJoining: string | undefined
): Promise<{
  lopDays: number,
  leavesTakenThisMonth: number,
  paidLeavesThisMonth: number,
  leaveLopDays: number,
  attendanceLopDays: number,
}> {
  const supabase = createClient();
  const [leaves, profileRes] = await Promise.all([
    getUserLeaves(employeeUid),
    supabase.from("profiles").select("el_opening_balance, cl_opening_balance, shift_id, role, designation, inactive_since").eq("id", employeeUid).single(),
  ]);
  const elOpeningBalance = profileRes.data?.el_opening_balance || 0;
  const clOpeningBalance = profileRes.data?.cl_opening_balance || 0;

  const { elMonths, clMonths, elWindowStart, clWindowStart, clOpeningBalanceApplies } = getElClWindow(dateOfJoining, year, month);

  // Both categories' Paid/LOP math now comes from the single shared
  // implementation in lib/leave.ts (computeCategoryMonthUsage) - identical
  // inputs, identical output shape, byte-for-byte the same formula this
  // file used to compute privately.
  const el = computeCategoryMonthUsage(leaves, "Earned Leave", elOpeningBalance, elMonths, elWindowStart, false, month, year);
  const cl = computeCategoryMonthUsage(leaves, "Casual Leave", clOpeningBalanceApplies ? clOpeningBalance : 0, clMonths, clWindowStart, true, month, year);

  const leavesTakenInMonth = el.takenInMonth + cl.takenInMonth;
  const paidLeavesThisMonth =
    Math.min(el.takenInMonth, el.availableBalanceAtStartOfMonth) +
    Math.min(cl.takenInMonth, cl.availableBalanceAtStartOfMonth);
  const unpaidLeaves = el.unpaidLeaves + cl.unpaidLeaves;

  // Attendance-based LOP, two sources, never overlapping:
  //
  //   A. Absent (1 day) / Half Day (0.5 day) rows actually marked in the
  //      Attendance table for this month - unchanged from before.
  //
  //   B. Days with NO attendance row at all, that would show up as
  //      "Absent" on the Attendance screen's own placeholder logic
  //      (isUnrecordedDayAnAbsence above) - i.e. no clock-in, no HR edit,
  //      no approved leave, and it isn't a Week Off or Holiday. Previously
  //      these were silently skipped entirely (explicit project-owner
  //      decision at the time); now they count as a full LOP day each,
  //      matching what HR already visually sees as "Absent" for that day.
  //
  // In both cases, any date already covered by an approved leave in
  // EITHER category's map is skipped, so the same calendar day is never
  // deducted twice.
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: attendanceRows, error: attendanceErr } = await supabase
    .from("attendance")
    .select("date, status, is_half_day")
    .eq("user_id", employeeUid)
    .gte("date", monthStart)
    .lte("date", monthEnd);
  if (attendanceErr) throw attendanceErr;

  let attendanceLopDays = 0;
  const recordedDates = new Set<string>();
  (attendanceRows || []).forEach((row: any) => {
    recordedDates.add(row.date);
    if (el.leaveMap.has(row.date) || cl.leaveMap.has(row.date)) return;
    if (row.status === "Absent") attendanceLopDays += 1;
    else if (row.is_half_day) attendanceLopDays += 0.5;
  });

  // A day already excluded from el.leaveMap/cl.leaveMap is NOT necessarily
  // a day with no leave application - those maps deliberately exclude
  // Pending rows and rows already folded into the opening-balance snapshot
  // (countedInOpeningBalance), purely to keep the BALANCE math from
  // double-counting. For "did this employee have ANY leave application
  // covering this day" - the actual question here - every Approved or
  // Pending row counts, regardless of category or that flag. Built from
  // the full, un-filtered `leaves` list so a day already explained by a
  // real application (even a pre-split one already settled into the
  // opening balance, or one still awaiting a decision) is never wrongly
  // flagged as an unexcused absence.
  const anyLeaveCoversDate = new Set<string>();
  leaves.forEach((l) => {
    if (l.status !== "Approved" && l.status !== "Pending") return;
    if (l.leaveType === "Manual Credit" || l.leaveType === "Manual Deduction") return;
    const s = dateOnlyToLocalDate(l.startDate);
    const e = dateOnlyToLocalDate(l.endDate);
    if (!s || !e) return;
    const c = new Date(s);
    while (c <= e) {
      anyLeaveCoversDate.add(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`);
      c.setDate(c.getDate() + 1);
    }
  });

  // Evaluation window for "unrecorded day" checks: never before the
  // employee joined, never past today (a day that hasn't finished yet
  // can't be judged an absence), never past the employee going Inactive.
  const joinDate = dateOnlyToLocalDate(dateOfJoining);
  let startDay = 1;
  if (joinDate) {
    if (joinDate.getFullYear() === year && joinDate.getMonth() + 1 === month) startDay = joinDate.getDate();
    else if (joinDate.getFullYear() > year || (joinDate.getFullYear() === year && joinDate.getMonth() + 1 > month)) startDay = daysInMonth + 1; // joins after this month entirely
  }

  let endDay = daysInMonth;
  const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (todayIST.getFullYear() === year && todayIST.getMonth() + 1 === month) endDay = Math.min(endDay, todayIST.getDate() - 1);
  else if (todayIST.getFullYear() < year || (todayIST.getFullYear() === year && todayIST.getMonth() + 1 < month)) endDay = 0;

  const inactiveSince = profileRes.data?.inactive_since ? new Date(profileRes.data.inactive_since) : null;
  if (inactiveSince && !isNaN(inactiveSince.getTime())) {
    if (inactiveSince.getFullYear() === year && inactiveSince.getMonth() + 1 === month) endDay = Math.min(endDay, inactiveSince.getDate() - 1);
    else if (inactiveSince.getFullYear() < year || (inactiveSince.getFullYear() === year && inactiveSince.getMonth() + 1 < month)) endDay = 0;
  }

  const shifts = await getShifts().catch(() => []);
  const shift = shifts.find((s) => s.id === profileRes.data?.shift_id);
  const isImmigration = legacyIsImmigration(profileRes.data?.role, profileRes.data?.designation);

  for (let day = startDay; day <= endDay; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (recordedDates.has(dateStr)) continue;
    if (anyLeaveCoversDate.has(dateStr)) continue;
    if (isUnrecordedDayAnAbsence(dateStr, year, month, day, shift, isImmigration)) {
      attendanceLopDays += 1;
    }
  }

  return {
    lopDays: unpaidLeaves + attendanceLopDays,
    leavesTakenThisMonth: leavesTakenInMonth,
    paidLeavesThisMonth,
    leaveLopDays: unpaidLeaves,
    attendanceLopDays,
  };
};
