"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Plus, Calendar, Clock, CheckCircle2, LayoutGrid, List } from "lucide-react";
import { applyLeave, listenToUserLeaves, LeaveRequest, calculateAccruedLeaves } from "@/lib/leave";
import LeaveCalendar from "./LeaveCalendar";
import ApplyLeaveModal from "./ApplyLeaveModal";

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTimestamp = (ts: any) => {
  if (!ts) return "-";
  if (ts.toDate) {
    return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return "-";
};

const initialLeaveBalances = [
  { type: "Total Leaves", total: 0, used: 0, pending: 0, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
  { type: "Leaves This Month", total: 0, used: 0, pending: 0, icon: Calendar, color: "text-blue-500", bg: "bg-blue-50" }
];

export default function EmployeeLeaveDashboard() {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState(initialLeaveBalances);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);

    const unsubscribe = listenToUserLeaves(profile.uid, (fetched) => {
      setLeaves(fetched);

      const updatedBalances = initialLeaveBalances.map(bal => ({ ...bal, used: 0, pending: 0 }));
      
      const totalAccrued = calculateAccruedLeaves(profile?.dateOfJoining, fetched);
      updatedBalances[0].total = totalAccrued;
      
      let totalUsed = 0, totalPending = 0;
      let usedThisMonth = 0;
      
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      fetched.forEach(l => {
        if (l.status === "Approved" && l.leaveType !== "Manual Credit" && l.leaveType !== "Manual Deduction") {
            totalUsed += l.days;
            const start = new Date(l.startDate);
            if (start.getMonth() === currentMonth && start.getFullYear() === currentYear) {
                usedThisMonth += l.days;
            }
        }
        if (l.status === "Pending" && l.leaveType !== "Manual Credit" && l.leaveType !== "Manual Deduction") totalPending += l.days;
      });

      
      updatedBalances[0].used = totalUsed;
      updatedBalances[0].pending = totalPending;
      updatedBalances[1].used = usedThisMonth;

      
      // We need a way to pass usedThisMonth to the state so we can render the second card.
      // Let's modify initialLeaveBalances to hold two items instead!


      setBalances(updatedBalances);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleApplySubmit = async (data: { leaveType: string; startDate: string; endDate: string; days: number; reason: string }) => {
    if (!profile?.uid) return;
    setIsSubmitting(true);

    await applyLeave(
      profile.uid,
      profile.fullName,
      profile.department || "General",
      data.leaveType,
      data.startDate,
      data.endDate,
      data.days,
      data.reason,
      profile.role
    );

    setIsModalOpen(false);
    setIsSubmitting(false);
  };

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
          <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-9 px-4 shadow-sm text-sm">
            <Plus className="h-4 w-4 mr-1.5" /> Apply Leave
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {balances.map((leave, i) => {
          const available = Math.max(0, leave.total - leave.used - leave.pending);
          return (
            <motion.div key={leave.type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`p-2 rounded-xl ${leave.bg}`}>
                      <leave.icon className={`h-4 w-4 ${leave.color}`} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">{leave.type}</h3>
                  </div>
                  
                                    <div className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">{leave.type === "Leaves This Month" ? leave.used : available}</span>
                    {leave.type !== "Leaves This Month" && <span className="text-slate-500 text-[11px] font-semibold">/ {leave.total} days</span>}
                  </div>
                  {leave.type !== "Leaves This Month" && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Used</p>
                      <p className="text-base font-black text-slate-800">{leave.used}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Pending</p>
                      <p className="text-base font-black text-slate-800">{leave.pending}</p>
                    </div>
                  </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
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
                    <th className="px-5 py-3 font-bold tracking-wider">Duration</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Days</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Applied On</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Loading leaves...</td></tr>
                  ) : leaves.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No leave applications found.</td></tr>
                  ) : leaves.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3 font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{record.leaveType}</td>
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

      <ApplyLeaveModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleApplySubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
