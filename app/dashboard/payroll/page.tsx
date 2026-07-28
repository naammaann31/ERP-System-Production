"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, FileText, Download, Edit, Plus, Users, Calculator, ArrowRight, Save, X, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  SalaryStructure,
  PayrollRecord,
  saveSalaryStructure,
  getSalaryStructure,
  calculateSalaryBreakup,
  generatePayroll,
  getEmployeePayrolls,
  getAllPayrolls,
  deletePayroll
} from "@/lib/payroll";
import PayslipDocument from "@/components/payroll/PayslipDocument";
import { getUserLeaves } from "@/lib/leave";

// Employee Type
interface Employee {
  uid: string;
  id: string;
  name: string;
  department: string;
  designation: string;
}

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

function HRPayrollDashboard() {
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
  const [division, setDivision] = useState("");
  const [incentives, setIncentives] = useState<number>(0);
  const [professionalTax, setProfessionalTax] = useState<number>(200);
  const [incomeTax, setIncomeTax] = useState<number>(0);
  const [providentFund, setProvidentFund] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("Bank Transfer");
  
  const [allPayrolls, setAllPayrolls] = useState<PayrollRecord[]>([]);

  useEffect(() => {
    let emps1: any[] = [];
    let emps2: any[] = [];
    let loaded1 = false;
    let loaded2 = false;

    const updateEmployees = () => {
      const combined = [...emps1, ...emps2].filter((v, i, a) => a.findIndex(t => (t.uid === v.uid)) === i);
      combined.sort((a, b) => b.createdAt - a.createdAt);
      setEmployees(combined);
      if (loaded1 && loaded2) setLoading(false);
    };

    const q1 = collection(db, "users");
    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      emps1 = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        emps1.push({
          uid: doc.id,
          id: data.employeeId || "N/A",
          name: data.fullName || "Unnamed",
          department: data.role === "OPS_HR" ? "HR" : (data.role || "Employee"),
          designation: data.designation || "N/A",
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
        });
      });
      loaded1 = true;
      updateEmployees();
    });

    const q2 = collection(db, "Users");
    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      emps2 = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        emps2.push({
          uid: doc.id,
          id: data.employeeId || "N/A",
          name: data.fullName || "Unnamed",
          department: data.role === "OPS_HR" ? "HR" : (data.role || "Employee"),
          designation: data.designation || "N/A",
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
        });
      });
      loaded2 = true;
      updateEmployees();
    });
    
    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, []);

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
      
      // Limits based on leave types
      const limits: Record<string, number> = {
          "Paid Leave (PL)": 12,
          "Casual Leave": 6,
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
              // The limit was already reached before this month, so all leaves this month are LOP
              lopTotal += currentLeaves;
          } else {
              // The limit might be reached during this month
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
      setTravelAllowance(3000); // Fixed at 3000
      setOtherAllowances(struct.otherAllowances || 0);
      setOtherDeductions(struct.otherDeductions || 0);
    } else {
      setSalaryStructure(null);
      setGrossSalary(0);
      setTravelAllowance(3000); // Fixed at 3000
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
      otherAllowances,
      otherDeductions
    });
    setIsConfigModalOpen(false);
    alert("Salary structure updated successfully!");
  };

  const openGenerateModal = async (emp: Employee) => {
    setSelectedEmployee(emp);
    const struct = await getSalaryStructure(emp.uid);
    if (!struct) {
      alert("Please configure the salary structure for this employee first.");
      return;
    }
    setSalaryStructure(struct);
    setDaysInMonth(30);
    setDateOfJoining("");
    setBankName("");
    setDivision("");
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
        selectedEmployee.designation,
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
      alert("Payroll generated successfully!");
      getAllPayrolls().then(setAllPayrolls);
    } catch (err: any) {
      alert(err.message);
    }
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
                employees.map(emp => (
                  <tr key={emp.uid} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {emp.name}
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
                        <button 
                          onClick={() => openGenerateModal(emp)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" /> Generate Payroll
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
                    onClick={async () => {
                      if (window.confirm(`Delete payroll for ${pr.employeeName} (${pr.month}/${pr.year})?`)) {
                        await deletePayroll(pr.id!);
                        getAllPayrolls().then(setAllPayrolls);
                      }
                    }}
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

      {/* Modals */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Salary Configuration</h2>
                <p className="text-xs text-slate-500 font-medium">{selectedEmployee?.name}</p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gross Salary (₹)</label>
                  <input type="number" value={grossSalary || ''} onChange={e => setGrossSalary(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Travel Allowance (₹)</label>
                  <input type="number" value={3000} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Other Allowances (₹)</label>
                  <input type="number" value={otherAllowances || ''} onChange={e => setOtherAllowances(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Other Deductions (₹)</label>
                  <input type="number" value={otherDeductions || ''} onChange={e => setOtherDeductions(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><Calculator className="w-4 h-4 text-blue-500" /> Live Breakup Preview</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Basic (50%)</span><span className="font-bold text-slate-700">₹{preview.basic.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">HRA (20%)</span><span className="font-bold text-slate-700">₹{preview.hra.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Travel</span><span className="font-bold text-slate-700">₹{preview.travelAllowance.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Special</span><span className="font-bold text-slate-700">₹{preview.specialAllowance.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Other All.</span><span className="font-bold text-slate-700">₹{preview.otherAllowances.toLocaleString()}</span></div>
                  <div className="border-t border-slate-200 my-2 pt-2 flex justify-between font-bold text-slate-900">
                    <span>Total Earnings</span><span>₹{preview.totalEarnings.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button onClick={() => setIsConfigModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleSaveStructure} className="px-5 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center gap-2"><Save className="w-4 h-4" /> Save Configuration</button>
            </div>
          </motion.div>
        </div>
      )}

      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Generate Payroll</h2>
                <p className="text-xs text-slate-500 font-medium">{selectedEmployee?.name}</p>
              </div>
              <button onClick={() => setIsGenerateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Month</label>
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all">
                    {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Year</label>
                  <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">LOP Days</label>
                  <input type="number" value={lopDays} onChange={(e) => setLopDays(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Days in Month</label>
                  <input type="number" value={daysInMonth} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date of Joining</label>
                  <input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bank Name</label>
                  <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Bank of Baroda" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Division</label>
                  <input type="text" value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g. Vectra Staffing" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Incentives</label>
                  <input type="number" value={incentives} onChange={(e) => setIncentives(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Prof. Tax</label>
                  <input type="number" value={professionalTax} onChange={(e) => setProfessionalTax(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Income Tax</label>
                  <input type="number" value={incomeTax} onChange={(e) => setIncomeTax(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">PF</label>
                  <input type="number" value={providentFund} onChange={(e) => setProvidentFund(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Date</label>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mode of Payment</label>
                  <input type="text" value={modeOfPayment} onChange={(e) => setModeOfPayment(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mt-4">
                <p className="text-xs font-medium text-amber-700 flex justify-between"><span>LOP Deduction:</span> <span>₹{preview.lopDeduction.toLocaleString()}</span></p>
                <p className="text-xs font-medium text-amber-700 flex justify-between mt-1"><span>Tax (PT + TDS):</span> <span>₹{(preview.taxDeduction + preview.incomeTax).toLocaleString()}</span></p>
                <p className="text-xs font-medium text-amber-700 flex justify-between mt-1"><span>Total Deductions:</span> <span className="font-bold">₹{preview.totalDeductions.toLocaleString()}</span></p>
                <div className="border-t border-amber-200 my-2 pt-2 flex justify-between">
                  <span className="font-bold text-amber-900 text-sm">Net Payable:</span>
                  <span className="font-black text-amber-900 text-lg">₹{preview.netSalary.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button onClick={() => setIsGenerateModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleGeneratePayroll} className="px-5 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center gap-2"><Plus className="w-4 h-4" /> Generate Final</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function EmployeePayrollDashboard() {
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
                      <td className="px-6 py-4 font-bold text-slate-700">₹{pr.netSalary.toLocaleString()}</td>
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
