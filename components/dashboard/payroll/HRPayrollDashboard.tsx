"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  SalaryStructure,
  PayrollRecord,
  saveSalaryStructure,
  getSalaryStructure,
  calculateSalaryBreakup,
  generatePayroll,
  getAllPayrolls,
  deletePayroll
} from "@/lib/payroll";
import PayslipDocument from "@/components/payroll/PayslipDocument";
import { getUserLeaves } from "@/lib/leave";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import SalaryConfigModal from "./SalaryConfigModal";
import GeneratePayrollModal from "./GeneratePayrollModal";

interface Employee {
  uid: string;
  id: string;
  name: string;
  department: string;
  jobRole: string;
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
  const [daysInMonth, setDaysInMonth] = useState<number>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
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

  useEffect(() => {
    if (!profile) return;

    const q = collection(db, "users");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        emps.push({
          uid: doc.id,
          id: data.employeeId || "N/A",
          name: data.fullName || "Unnamed",
          department: data.role === "OPS_HR" ? "HR" : (data.role || "Employee"),
          jobRole: data.jobRole || "N/A",
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
        });
      });
      emps.sort((a, b) => b.createdAt - a.createdAt);
      setEmployees(emps);
      setLoading(false);
    });
    
    return () => unsubscribe();
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
    const fetchAndCalculateLop = async () => {
      if (!selectedEmployee) return;
      
      const leaves = await getUserLeaves(selectedEmployee.uid);
      
      // Filter for approved leaves in the selected year
      const yearLeaves = leaves.filter(l => {
          const start = new Date(l.startDate);
          return start.getFullYear() === year && l.status === "Approved";
      });
  
      let lopTotal = 0;
      
      const limits: Record<string, number> = {
          "Paid Leave (PL)": 12,
          "Casual Leave": 12,
          "Sick Leave": 0
      };
  
      for (const [type, limit] of Object.entries(limits)) {
          const typeLeaves = yearLeaves.filter(l => l.leaveType === type);
          
          let previousLeaves = 0;
          let currentLeaves = 0;
          
          typeLeaves.forEach(l => {
              const start = new Date(l.startDate);
              if (start.getMonth() + 1 < month) {
                  previousLeaves += l.days;
              } else if (start.getMonth() + 1 === month) {
                  currentLeaves += l.days;
              }
          });
  
          if (previousLeaves >= limit) {
              lopTotal += currentLeaves;
          } else {
              lopTotal += Math.max(0, (previousLeaves + currentLeaves) - limit);
          }
      }
      
      setLopDays(lopTotal);
    };

    fetchAndCalculateLop();
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
    setDateOfJoining("");
    setBankName("");
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
      await generatePayroll(
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
    setPayrollToDelete(null);
    toast.success("Payroll record deleted");
  };

  // Preview calculations
  const preview = calculateSalaryBreakup(grossSalary, travelAllowance, lopDays, daysInMonth, otherDeductions, otherAllowances, incentives, professionalTax, incomeTax, providentFund);

  return (
    <div className="space-y-6">
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
                  const currentMonth = new Date().getMonth() + 1;
                  const currentYear = new Date().getFullYear();
                  const currentMonthName = new Date().toLocaleString('default', { month: 'short' });

                  return employees.map(emp => {
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
                              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                            >
                              <Edit className="w-3.5 h-3.5 text-slate-500" /> Configure Salary
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

      <div>
        <h3 className="font-bold text-lg text-slate-800 mb-4">Recent Payrolls Generated</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPayrolls.map(pr => (
            <Card key={pr.id} className="border border-slate-200 shadow-sm p-4 relative group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-slate-900">{pr.employeeName}</h4>
                  <p className="text-xs text-slate-500">{pr.month}/{pr.year}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">Paid</Badge>
                  <button
                    onClick={() => setPayrollToDelete(pr)}
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                    title="Delete Payroll"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-end mt-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Net Salary</p>
                  <p className="font-black text-xl text-slate-800">₹{pr.netSalary.toLocaleString()}</p>
                </div>
                <PayslipDocument payroll={pr} />
              </div>
            </Card>
          ))}
        </div>
      </div>

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
        daysInMonth={daysInMonth}
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
