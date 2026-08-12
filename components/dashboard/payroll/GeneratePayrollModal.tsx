"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ChevronDown } from "lucide-react";

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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DIVISIONS = ["Vectra Staffing", "Vectra Immigration", "Vectra Group"];

const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:font-normal placeholder:text-slate-400";
const labelClass = "block text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-1.5";

function CustomSelect({ value, options, onChange }: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all flex items-center justify-between gap-2 hover:bg-white"
      >
        <span>{selected?.label ?? "Select..."}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
            className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-2xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)] border border-slate-100 py-1.5 z-[200]"
          >
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-[calc(100%-12px)] mx-1.5 text-left px-3 py-2 text-sm rounded-xl transition-all duration-150 flex items-center gap-2.5 ${
                  value === opt.value
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-700 hover:bg-slate-50 font-medium"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === opt.value ? "bg-white/80" : "bg-slate-300"}`} />
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GeneratePayrollModal({
  isOpen, onClose, onGenerate, selectedEmployee,
  month, setMonth, year, setYear,
  lopDays, setLopDays, daysInMonth,
  dateOfJoining, setDateOfJoining,
  bankName, setBankName,
  division, setDivision,
  incentives, setIncentives,
  professionalTax, setProfessionalTax,
  incomeTax, setIncomeTax,
  providentFund, setProvidentFund,
  paymentDate, setPaymentDate,
  modeOfPayment, setModeOfPayment,
  preview
}: GeneratePayrollModalProps) {
  if (!isOpen) return null;

  const monthOptions = MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }));
  const divisionOptions = DIVISIONS.map(d => ({ label: d, value: d }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Generate Payroll</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{selectedEmployee?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* Month + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Month</label>
              <CustomSelect value={String(month)} options={monthOptions} onChange={(v) => setMonth(Number(v))} />
            </div>
            <div>
              <label className={labelClass}>Year</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass} />
            </div>
          </div>

          {/* LOP Days + Days in Month */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>LOP Days</label>
              <input type="number" value={lopDays} onChange={(e) => setLopDays(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Days in Month</label>
              <input type="number" value={daysInMonth} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed" />
            </div>
          </div>

          {/* Date of Joining + Bank Name + Division */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Date of Joining</label>
              <input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Bank Name</label>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Bank of Baroda" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Division</label>
              <CustomSelect value={division} options={divisionOptions} onChange={setDivision} />
            </div>
          </div>

          {/* Incentives, Prof Tax, Income Tax, PF */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Incentives</label>
              <input type="number" value={incentives} onChange={(e) => setIncentives(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Prof. Tax</label>
              <input type="number" value={professionalTax} onChange={(e) => setProfessionalTax(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Income Tax</label>
              <input type="number" value={incomeTax} onChange={(e) => setIncomeTax(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>PF</label>
              <input type="number" value={providentFund} onChange={(e) => setProvidentFund(Number(e.target.value))} className={inputClass} />
            </div>
          </div>

          {/* Payment Date + Mode of Payment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mode of Payment</label>
              <input type="text" value={modeOfPayment} onChange={(e) => setModeOfPayment(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 p-5 rounded-2xl">
            <p className="text-[10px] font-bold text-amber-700/60 uppercase tracking-[0.12em] mb-3">Payroll Summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-amber-800">
                <span>LOP Deduction</span><span>?{preview.lopDeduction.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-amber-800">
                <span>Tax (PT + TDS)</span><span>?{(preview.taxDeduction + preview.incomeTax).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-amber-800">
                <span>Total Deductions</span><span>?{preview.totalDeductions.toLocaleString()}</span>
              </div>
            </div>
            <div className="border-t border-amber-200/80 mt-3 pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-amber-900">Net Payable</span>
              <span className="text-xl font-black text-amber-900">?{preview.netSalary.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200/60 transition-colors">Cancel</button>
          <button onClick={onGenerate} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md active:scale-95 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Generate Final
          </button>
        </div>
      </motion.div>
    </div>
  );
}
