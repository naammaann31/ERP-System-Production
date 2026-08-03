"use client";

import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";

interface GeneratePayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => void;
  selectedEmployee: any;
  month: number;
  setMonth: (val: number) => void;
  year: number;
  setYear: (val: number) => void;
  lopDays: number;
  setLopDays: (val: number) => void;
  daysInMonth: number;
  dateOfJoining: string;
  setDateOfJoining: (val: string) => void;
  bankName: string;
  setBankName: (val: string) => void;
  division: string;
  setDivision: (val: string) => void;
  incentives: number;
  setIncentives: (val: number) => void;
  professionalTax: number;
  setProfessionalTax: (val: number) => void;
  incomeTax: number;
  setIncomeTax: (val: number) => void;
  providentFund: number;
  setProvidentFund: (val: number) => void;
  paymentDate: string;
  setPaymentDate: (val: string) => void;
  modeOfPayment: string;
  setModeOfPayment: (val: string) => void;
  preview: any;
}

export default function GeneratePayrollModal({
  isOpen,
  onClose,
  onGenerate,
  selectedEmployee,
  month,
  setMonth,
  year,
  setYear,
  lopDays,
  setLopDays,
  daysInMonth,
  dateOfJoining,
  setDateOfJoining,
  bankName,
  setBankName,
  division,
  setDivision,
  incentives,
  setIncentives,
  professionalTax,
  setProfessionalTax,
  incomeTax,
  setIncomeTax,
  providentFund,
  setProvidentFund,
  paymentDate,
  setPaymentDate,
  modeOfPayment,
  setModeOfPayment,
  preview
}: GeneratePayrollModalProps) {
  if (!isOpen) return null;

  return (
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50 transition-colors">
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
              <select 
                value={division} 
                onChange={(e) => setDivision(e.target.value)} 
                className="w-full h-[42px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%25234b5563%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[size:1.25rem] bg-[position:right_0.75rem_center] bg-no-repeat pr-10"
              >
                <option value="Vectra Staffing">Vectra Staffing</option>
                <option value="Vectra Immigration">Vectra Immigration</option>
                <option value="Vectra Group">Vectra Group</option>
              </select>
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
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
          <button onClick={onGenerate} className="px-5 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center gap-2"><Plus className="w-4 h-4" /> Generate Final</button>
        </div>
      </motion.div>
    </div>
  );
}
