"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, CheckCircle2, LayoutGrid, List, Info, X } from "lucide-react";
import { applyLeave, listenToUserLeaves, LeaveRequest, calculateElClBalances, formatDateOnly, LeaveCategory } from "@/lib/leave";
import LeaveCalendar from "./LeaveCalendar";
import ApplyLeaveModal from "./ApplyLeaveModal";

const formatDate = formatDateOnly;

const formatTimestamp = (ts: any) => {
  if (!ts) return "-";
  if (ts.toDate) {
    return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return "-";
};

export default function EmployeeLeaveDashboard() {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [elBalance, setElBalance] = useState({ accrued: 0, used: 0, pending: 0, available: 0 });
  const [clBalance, setClBalance] = useState({ accrued: 0, used: 0, pending: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);

    const unsubscribe = listenToUserLeaves(profile.uid, (fetched) => {
      setLeaves(fetched);
      const { earned, casual } = calculateElClBalances(
        profile?.dateOfJoining,
        fetched,
        profile?.inactiveSince,
        profile?.elOpeningBalance,
        profile?.clOpeningBalance
      );
      setElBalance(earned);
      setClBalance(casual);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleApplySubmit = async (data: { leaveType: string; leaveCategory: LeaveCategory; startDate: string; endDate: string; days: number; reason: string }) => {
    if (!profile?.uid) return;
    setIsSubmitting(true);

    await applyLeave(
      profile.uid,
      profile.fullName,
      profile.department || "General",
      data.leaveType,
      data.leaveCategory,
      data.startDate,
      data.endDate,
      data.days,
      data.reason,
      profile.role
    );

    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  const balanceTiles = [
    { type: "Earned Leave", balance: elBalance, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
    { type: "Casual Leave", balance: clBalance, icon: Calendar, color: "text-blue-500", bg: "bg-blue-50" },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-4 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">View your leave balance and apply for time off.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode("table")} className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("calendar")} className={`p-1.5 rounded-md transition-colors ${viewMode === "calendar" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setShowRules(true)} className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
            <Info className="h-4 w-4 text-slate-400" /> View Leave Rules
          </button>
          <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-9 px-4 shadow-sm text-sm">
            <Plus className="h-4 w-4 mr-1.5" /> Apply Leave
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {balanceTiles.map((tile, i) => (
          <motion.div key={tile.type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`p-2 rounded-xl ${tile.bg}`}>
                    <tile.icon className={`h-4 w-4 ${tile.color}`} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">{tile.type}</h3>
                </div>
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">{tile.balance.available}</span>
                  <span className="text-slate-500 text-[11px] font-semibold">/ {tile.balance.accrued} days</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Used</p>
                    <p className="text-base font-black text-slate-800">{tile.balance.used}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Pending</p>
                    <p className="text-base font-black text-slate-800">{tile.balance.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {viewMode === "calendar" ? (
        <LeaveCalendar leaves={leaves} isHR={false} />
      ) : (
        <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 px-5 py-4 bg-white">
            <CardTitle className="text-lg font-bold text-slate-800">Recent Leave Applications</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 font-bold tracking-wider">Leave Type</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Category</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Duration</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Days</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Applied On</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Loading leaves...</td></tr>
                  ) : leaves.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No leave applications found.</td></tr>
                  ) : leaves.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3 font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{record.leaveType}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className={`font-medium text-[10px] ${record.leaveCategory === "Earned Leave" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                          {record.leaveCategory}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-600">
                        {formatDate(record.startDate)} - {formatDate(record.endDate)}
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-800">{record.leaveType === 'Manual Credit' ? `+${record.days}` : record.leaveType === 'Manual Deduction' ? record.days : record.days}</td>
                      <td className="px-5 py-3 font-medium text-slate-500">{formatTimestamp(record.appliedOn)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={record.status === "Approved" ? "success" : record.status === "Rejected" ? "destructive" : "warning"} className="font-semibold text-[10px] py-0.5">
                          {record.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ApplyLeaveModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleApplySubmit}
        isSubmitting={isSubmitting}
        elAvailable={elBalance.available}
        clAvailable={clBalance.available}
      />

      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Leave Rules</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Company policies &amp; guidelines</p>
                </div>
                <button onClick={() => setShowRules(false)} className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-sm text-slate-600">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Earned Leave (EL)</h3>
                  <p className="mt-2 pl-4">Unused Earned Leave is carried forward to the next financial year — it never expires.</p>
                </div>

                <div className="pt-2">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Casual Leave (CL)</h3>
                  <p className="mt-2 pl-4">Intended for short-term or personal leave requirements. Unused Casual Leave expires at the end of the financial year and does not carry forward.</p>
                </div>

                <div className="pt-2">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Policy</h3>
                  <ul className="mt-2 space-y-1.5 pl-4 list-disc marker:text-slate-300">
                    <li>Every employee receives <span className="font-semibold text-slate-800">2 leaves on the 1st of every month</span>.</li>
                    <li>The monthly allocation consists of <span className="font-semibold text-slate-800">1 Earned Leave (EL) and 1 Casual Leave (CL)</span>.</li>
                    <li>Earned Leave and Casual Leave are maintained as <span className="font-semibold text-slate-800">separate balances</span>.</li>
                    <li>Employees must <span className="font-semibold text-slate-800">select the appropriate leave category</span> when submitting a leave application.</li>
                    <li>Leave can only be applied against the <span className="font-semibold text-slate-800">available balance of the selected category</span>.</li>
                    <li>Unused Casual Leaves <span className="font-semibold text-red-500">expire automatically</span> at the end of the financial year.</li>
                    <li>Unused Earned Leaves are <span className="font-semibold text-emerald-600">carried forward</span> to the next financial year.</li>
                    <li>The financial year rollover takes place on <span className="font-semibold text-slate-800">1 April at 00:00 hours (IST)</span>.</li>
                    <li>Earned Leave carry-forward is cumulative, subject to existing applicable leave policies.</li>
                    <li>All leave applications must follow the <span className="font-semibold text-slate-800">existing approval workflow</span>.</li>
                    <li>Leave applications must be submitted through <span className="font-semibold text-slate-800">both the official email and the ERP system</span>.</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
