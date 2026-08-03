"use client";

import { motion } from "framer-motion";
import { Calculator, Save, X } from "lucide-react";

interface SalaryConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  selectedEmployee: any;
  grossSalary: number;
  setGrossSalary: (val: number) => void;
  travelAllowance: number;
  otherDeductions: number;
  setOtherDeductions: (val: number) => void;
  preview: any;
}

export default function SalaryConfigModal({
  isOpen,
  onClose,
  onSave,
  selectedEmployee,
  grossSalary,
  setGrossSalary,
  travelAllowance,
  otherDeductions,
  setOtherDeductions,
  preview
}: SalaryConfigModalProps) {
  if (!isOpen) return null;

  return (
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50 transition-colors">
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
              <input type="number" value={travelAllowance} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed transition-all" />
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

              <div className="border-t border-slate-200 my-2 pt-2 flex justify-between font-bold text-slate-900">
                <span>Total Earnings</span><span>₹{preview.totalEarnings.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
          <button onClick={onSave} className="px-5 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center gap-2"><Save className="w-4 h-4" /> Save Configuration</button>
        </div>
      </motion.div>
    </div>
  );
}
