"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ChevronDown, Calendar } from "lucide-react";

export const calcDays = (start: string, end: string) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diff, 0);
};

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { leaveType: string; startDate: string; endDate: string; days: number; reason: string }) => void;
  isSubmitting: boolean;
}

export default function ApplyLeaveModal({ isOpen, onClose, onSubmit, isSubmitting }: ApplyLeaveModalProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("Paid Leave (PL)");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);

  const leaveOptions = ["Paid Leave (PL)", "Casual Leave"];
  const days = isHalfDay ? 0.5 : calcDays(startDate, endDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (days <= 0) return;
    onSubmit({ leaveType, startDate, endDate: isHalfDay ? startDate : endDate, days, reason });
    setStartDate("");
    setEndDate("");
    setReason("");
    setIsHalfDay(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
      >
        <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Apply for Leave</h2>
            <p className="text-xs font-semibold text-slate-500 mt-1">Submit your request for time off</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Leave Type</label>
            <div className="relative">
              <div
                className={`w-full bg-slate-50 border ${isDropdownOpen ? 'border-blue-500 ring-4 ring-blue-500/10 bg-white' : 'border-slate-200'} rounded-xl px-4 py-3 text-sm text-slate-800 font-semibold transition-all cursor-pointer flex items-center justify-between`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                {leaveType}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
              </div>

              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden"
                >
                  {leaveOptions.map((option) => (
                    <div
                      key={option}
                      onClick={() => {
                        setLeaveType(option);
                        setIsDropdownOpen(false);
                      }}
                      className={`px-4 py-3 text-sm font-semibold cursor-pointer transition-colors ${leaveType === option
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                      {option}
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Start Date</label>
              <input
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all uppercase"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (isHalfDay || !endDate || e.target.value > endDate) setEndDate(e.target.value);
                }}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">End Date</label>
              <input
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                value={isHalfDay ? startDate : endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isHalfDay}
                required={!isHalfDay}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="halfDay"
              checked={isHalfDay}
              onChange={(e) => {
                setIsHalfDay(e.target.checked);
                if (e.target.checked && startDate) {
                  setEndDate(startDate);
                }
              }}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="halfDay" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
              Apply for Half Day
            </label>
          </div>

          {days > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-bold text-blue-700">{days} day{days > 1 ? "s" : ""}</span>
              <span className="text-xs text-blue-500 font-medium">will be deducted</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Reason</label>
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all resize-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly explain your reason for leave..."
              required
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-200 font-bold hover:bg-slate-50 px-6">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || days <= 0} className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-6 shadow-md shadow-blue-500/20 active:scale-95 transition-all text-white">
              {isSubmitting ? "Applying..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
