import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Edit } from "lucide-react";
import { PayrollRecord } from "@/lib/payroll";

interface Employee {
  uid: string;
  id: string;
  name: string;
  department: string;
  jobRole: string;
  isConfigured?: boolean;
  dateOfJoining?: string;
}

interface EmployeePayrollTableProps {
  employees: Employee[];
  loading: boolean;
  searchQuery: string;
  filterMonth: string;
  allPayrolls: PayrollRecord[];
  openConfigModal: (emp: Employee) => void;
  openGenerateModal: (emp: Employee) => void;
}

export default function EmployeePayrollTable({
  employees,
  loading,
  searchQuery,
  filterMonth,
  allPayrolls,
  openConfigModal,
  openGenerateModal
}: EmployeePayrollTableProps) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium">Employee Name</th>
              <th className="px-6 py-4 font-medium">Department</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : (
              (() => {
                const [filterYearStr, filterMonthStr] = filterMonth.split('-');
                const currentMonth = parseInt(filterMonthStr, 10);
                const currentYear = parseInt(filterYearStr, 10);
                const currentMonthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'short' });

                const displayedEmployees = employees.filter(emp => emp.name.toLowerCase().includes(searchQuery.toLowerCase()));

                if (displayedEmployees.length === 0) {
                  return (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                        No employees found matching "{searchQuery}"
                      </td>
                    </tr>
                  );
                }

                return displayedEmployees.map(emp => {
                  const hasPayrollThisMonth = allPayrolls.some(
                    pr => pr.userId === emp.uid && pr.month === currentMonth && pr.year === currentYear
                  );

                  return (
                    <tr key={emp.uid} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{emp.name}</span>
                          {hasPayrollThisMonth ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold py-0.5">
                              Paid ({currentMonthName})
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold py-0.5">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <span className="block text-xs font-normal text-slate-500">{emp.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="font-medium text-[10px]">{emp.department}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openConfigModal(emp)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 border ${emp.isConfigured && !hasPayrollThisMonth
                              ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                              }`}
                          >
                            <Edit className={`w-3.5 h-3.5 ${emp.isConfigured && !hasPayrollThisMonth ? "text-green-600" : "text-slate-500"}`} /> Configure Salary
                          </button>
                          {hasPayrollThisMonth ? (
                            <button
                              onClick={() => openGenerateModal(emp)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" /> Regenerate
                            </button>
                          ) : (
                            <button
                              onClick={() => openGenerateModal(emp)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" /> Generate Payroll
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
