"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/AuthProvider";
import { PayrollRecord, getEmployeePayrolls } from "@/lib/payroll";
import PayslipDocument from "@/components/payroll/PayslipDocument";

export default function EmployeePayrollDashboard() {
  const { profile } = useAuth();
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);

  useEffect(() => {
    if (profile?.uid) {
      getEmployeePayrolls(profile.uid).then(setPayrolls);
    }
  }, [profile]);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-6 py-5 border-b border-slate-100 bg-white">
            <h2 className="text-lg font-bold text-slate-800">My Payslips</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">View and download your monthly salary slips.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Month/Year</th>
                  <th className="px-6 py-4 font-medium">Net Salary</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payrolls.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">No payslips found.</td></tr>
                ) : (
                  payrolls.map(pr => (
                    <tr key={pr.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{new Date(0, pr.month - 1).toLocaleString('default', { month: 'long' })} {pr.year}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{pr.netSalary.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <PayslipDocument payroll={pr} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
