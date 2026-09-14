"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Edit, Trash2, CalendarDays, ChevronDown, Check, Search } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getISTYearMonth, getRecentMonthOptions } from "@/lib/attendance";
import { motion, AnimatePresence } from "framer-motion";
import {
  SalaryStructure,
  PayrollRecord,
  saveSalaryStructure,
  getSalaryStructure,
  calculateSalaryBreakup,
  generatePayroll,
  getAllPayrolls,
  deletePayroll,
  calculateEmployeeLopAndLeaves
} from "@/lib/payroll";
import { updatePayrollExtraFields, getEmployeeBankName, getEmployeeProfileFields } from "@/app/actions/payroll";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import SalaryConfigModal from "./SalaryConfigModal";
import GeneratePayrollModal from "./GeneratePayrollModal";

import PayrollHeader from "./PayrollHeader";
import EmployeePayrollTable from "./EmployeePayrollTable";
import RecentPayrollsGrid from "./RecentPayrollsGrid";

interface Employee {
  uid: string;
  id: string;
  name: string;
  department: string;
  jobRole: string;
  isConfigured?: boolean;
  dateOfJoining?: string;
}

export default function HRPayrollDashboard() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [salaryStructure, setSalaryStructure] = useState<SalaryStructure | null>(null);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // Salary Form State
  const [grossSalary, setGrossSalary] = useState<number>(0);
  const [travelAllowance, setTravelAllowance] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [otherAllowances, setOtherAllowances] = useState<number>(0);

  // Generate Form State
  const [lopDays, setLopDays] = useState<number>(0);
  const [leavesTakenThisMonth, setLeavesTakenThisMonth] = useState<number>(0);
  const [paidLeavesThisMonth, setPaidLeavesThisMonth] = useState<number>(0);
  const [daysInMonth, setDaysInMonth] = useState<number>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
  const [daysWorked, setDaysWorked] = useState<number>(0);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [dateOfJoining, setDateOfJoining] = useState("");
  const [bankName, setBankName] = useState("");
  const [division, setDivision] = useState("Vectra Staffing");
  const [incentives, setIncentives] = useState<number>(0);
  const [professionalTax, setProfessionalTax] = useState<number>(200);
  const [incomeTax, setIncomeTax] = useState<number>(0);
  const [providentFund, setProvidentFund] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("Bank Transfer");

  const [allPayrolls, setAllPayrolls] = useState<PayrollRecord[]>([]);
  const [payrollToDelete, setPayrollToDelete] = useState<PayrollRecord | null>(null);

  const [filterMonth, setFilterMonth] = useState(getISTYearMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const monthOptions = useMemo(() => getRecentMonthOptions(12), []);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const [filterYearStr, filterMonthStr] = filterMonth.split('-');
    setMonth(parseInt(filterMonthStr, 10));
    setYear(parseInt(filterYearStr, 10));
  }, [filterMonth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!profile) return;

    const supabase = createClient();

    const fetchEmployees = async () => {
      const { data, error } = await supabase.from("profiles").select("*").neq("role", "Admin");
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }



      const emps = (data || []).map((row: any) => ({
        uid: row.id,
        id: row.employee_id || "N/A",
        name: row.full_name || "Unnamed",
        department: row.department || (row.role === "OPS_HR" ? "HR" : row.role === "Admin" ? "Admin" : (row.role || "Employee")),
        jobRole: row.job_role || "N/A",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
        isConfigured: false,
      }));
      emps.sort((a, b) => b.createdAt - a.createdAt);
      setEmployees(emps);
      setLoading(false);
    };

    fetchEmployees();

    const channel = supabase
      .channel(`profiles_payroll_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchEmployees)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  useEffect(() => {
    getAllPayrolls().then(setAllPayrolls);
  }, []);

  // Auto-calculate days in month based on selected month/year
  useEffect(() => {
    const days = new Date(year, month, 0).getDate();
    setDaysInMonth(days);
  }, [month, year]);

  useEffect(() => {
    const fetchLop = async () => {
      if (!selectedEmployee) return;
      try {
        const res = await calculateEmployeeLopAndLeaves(
          selectedEmployee.uid, 
          month, 
          year, 
          selectedEmployee.dateOfJoining
        );
        setLopDays(res.lopDays);
        setLeavesTakenThisMonth(res.leavesTakenThisMonth);
        setPaidLeavesThisMonth(res.paidLeavesThisMonth);
      } catch (err) {
        console.error("Failed to calculate LOP and Leaves:", err);
      }
    };

    fetchLop();
  }, [selectedEmployee, month, year]);

  const openConfigModal = async (emp: Employee) => {
    setSelectedEmployee(emp);
    const struct = await getSalaryStructure(emp.uid);
    if (struct) {
      setSalaryStructure(struct);
      setGrossSalary(struct.grossSalary);
      setTravelAllowance(3000);
      setOtherAllowances(struct.otherAllowances || 0);
      setOtherDeductions(struct.otherDeductions || 0);
    } else {
      setSalaryStructure(null);
      setGrossSalary(0);
      setTravelAllowance(3000);
      setOtherAllowances(0);
      setOtherDeductions(0);
    }
    setIsConfigModalOpen(true);
  };

  const handleSaveStructure = async () => {
    if (!selectedEmployee) return;
    await saveSalaryStructure(selectedEmployee.uid, {
      grossSalary,
      travelAllowance,
      otherAllowances: 0,
      otherDeductions
    });

    setEmployees(prev => prev.map(emp =>
      emp.uid === selectedEmployee.uid ? { ...emp, isConfigured: true } : emp
    ));

    setIsConfigModalOpen(false);
    toast.success("Salary structure updated successfully!");
  };

  const openGenerateModal = async (emp: Employee) => {
    setSelectedEmployee(emp);
    const struct = await getSalaryStructure(emp.uid);
    if (!struct) {
      toast.error("Please configure the salary structure for this employee first.");
      return;
    }
    setSalaryStructure(struct);
    const days = new Date(year, month, 0).getDate();
    setDaysInMonth(days);
    // Pre-populate from employee profile using server action (bypasses RLS)
    try {
      const [profileFields, bankNameResult] = await Promise.all([
        getEmployeeProfileFields(emp.uid),
        getEmployeeBankName(emp.uid),
      ]);
      setDateOfJoining(profileFields.dateOfJoining || emp.dateOfJoining || "");
      setBankName(bankNameResult || "");
    } catch {
      setDateOfJoining(emp.dateOfJoining || "");
      setBankName("");
    }
    setDivision("Vectra Staffing");
    setIncentives(0);
    setProfessionalTax(200);
    setIncomeTax(0);
    setProvidentFund(0);
    setPaymentDate("");
    setModeOfPayment("Bank Transfer");
    setIsGenerateModalOpen(true);
  };

  const handleGeneratePayroll = async () => {
    if (!selectedEmployee) return;
    try {
      const payroll = await generatePayroll(
        selectedEmployee.uid,
        selectedEmployee.name,
        month,
        year,
        lopDays,
        daysInMonth,
        selectedEmployee.id,
        selectedEmployee.jobRole,
        selectedEmployee.department,
        dateOfJoining,
        bankName,
        division,
        professionalTax,
        incomeTax,
        providentFund,
        incentives,
        paymentDate,
        modeOfPayment
      );

      if (payroll?.id) {
        await updatePayrollExtraFields(payroll.id, {
          date_of_joining: dateOfJoining,
          bank_name: bankName,
          division: division,
          department: selectedEmployee.department || selectedEmployee.jobRole || "",
          days_worked: daysWorked
        });
      }
      setIsGenerateModalOpen(false);
      toast.success("Payroll generated successfully!");
      getAllPayrolls().then(setAllPayrolls);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate payroll");
    }
  };

  const executeDeletePayroll = async () => {
    if (!payrollToDelete || !payrollToDelete.id) return;
    await deletePayroll(payrollToDelete.id);
    getAllPayrolls().then(setAllPayrolls);

    setEmployees(prev => prev.map(emp =>
      emp.uid === payrollToDelete.userId ? { ...emp, isConfigured: false } : emp
    ));

    setPayrollToDelete(null);
    toast.success("Payroll record deleted");
  };

  // Preview calculations
  const preview = calculateSalaryBreakup(grossSalary, travelAllowance, lopDays, daysInMonth, otherDeductions, otherAllowances, incentives, professionalTax, incomeTax, providentFund);

  const displayedPayrolls = allPayrolls.filter(pr => {
    const prDateStr = `${pr.year}-${String(pr.month).padStart(2, '0')}`;
    const matchesMonth = prDateStr === filterMonth;
    const matchesSearch = pr.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMonth && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PayrollHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterMonth={filterMonth}
        setFilterMonth={setFilterMonth}
        monthOptions={monthOptions}
      />

      <EmployeePayrollTable
        employees={employees}
        loading={loading}
        searchQuery={searchQuery}
        filterMonth={filterMonth}
        allPayrolls={allPayrolls}
        openConfigModal={openConfigModal}
        openGenerateModal={openGenerateModal}
      />

      <RecentPayrollsGrid
        displayedPayrolls={displayedPayrolls}
        setPayrollToDelete={setPayrollToDelete}
      />

      <SalaryConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleSaveStructure}
        selectedEmployee={selectedEmployee}
        grossSalary={grossSalary}
        setGrossSalary={setGrossSalary}
        travelAllowance={travelAllowance}
        otherDeductions={otherDeductions}
        setOtherDeductions={setOtherDeductions}
        preview={preview}
      />

      <GeneratePayrollModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={handleGeneratePayroll}
        selectedEmployee={selectedEmployee}
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        lopDays={lopDays}
        setLopDays={setLopDays}
        leavesTakenThisMonth={leavesTakenThisMonth}
        paidLeavesThisMonth={paidLeavesThisMonth}
        daysInMonth={daysInMonth}
        daysWorked={daysWorked}
        setDaysWorked={setDaysWorked}
        dateOfJoining={dateOfJoining}
        setDateOfJoining={setDateOfJoining}
        bankName={bankName}
        setBankName={setBankName}
        division={division}
        setDivision={setDivision}
        incentives={incentives}
        setIncentives={setIncentives}
        professionalTax={professionalTax}
        setProfessionalTax={setProfessionalTax}
        incomeTax={incomeTax}
        setIncomeTax={setIncomeTax}
        providentFund={providentFund}
        setProvidentFund={setProvidentFund}
        paymentDate={paymentDate}
        setPaymentDate={setPaymentDate}
        modeOfPayment={modeOfPayment}
        setModeOfPayment={setModeOfPayment}
        preview={preview}
      />

      <ConfirmModal
        isOpen={!!payrollToDelete}
        onClose={() => setPayrollToDelete(null)}
        onConfirm={executeDeletePayroll}
        title="Delete Payroll Record"
        description={`Are you sure you want to delete the payroll record for ${payrollToDelete?.employeeName} (${payrollToDelete?.month}/${payrollToDelete?.year})?`}
        confirmText="Delete Payroll"
        variant="danger"
      />
    </div>
  );
}




