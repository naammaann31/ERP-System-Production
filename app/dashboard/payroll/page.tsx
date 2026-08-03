"use client";

import { Banknote } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import HRPayrollDashboard from "@/components/dashboard/payroll/HRPayrollDashboard";
import EmployeePayrollDashboard from "@/components/dashboard/payroll/EmployeePayrollDashboard";

export default function PayrollPage() {
  const { profile } = useAuth();
  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";
  
  if (!profile) return null;

  return (
    <div className="max-w-[1400px] mx-auto pb-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-600" />
            Payroll Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isAdminOrHR 
              ? "Manage employee salaries, generate payrolls, and export payslips."
              : "View your salary structures and download your payslips."}
          </p>
        </div>
      </div>

      {isAdminOrHR ? <HRPayrollDashboard /> : <EmployeePayrollDashboard />}
    </div>
  );
}
