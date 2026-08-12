"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Plus, Calendar, AlertCircle, Users, Search, LayoutGrid, List, Check, X } from "lucide-react";
import { applyLeave, updateLeaveStatus, listenToAllLeaves, LeaveRequest } from "@/lib/leave";
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

export default function HRLeaveDashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "Admin";
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenToAllLeaves((fetched) => {
      const filtered = fetched.filter(req => {
        const myRole = profile?.role?.toUpperCase();
        const reqRole = req.role?.toUpperCase();
        if (myRole === "HR" && (reqRole === "HR" || reqRole === "ADMIN" || reqRole === "OPS_HR")) {
          return false;
        }
        return true;
      });
      setAllRequests(filtered);
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

  const handleAction = async (id: string, status: "Approved" | "Rejected") => {
    await updateLeaveStatus(id, status);
  };

  const hrStats = [
    { label: "Pending Approvals", value: allRequests.filter(r => r.status === "Pending").length, trend: "Live", trendUp: false, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-100", accent: "bg-amber-500" },
    { label: "On Leave Today", value: 0, trend: "0", trendUp: true, icon: Users, color: "text-blue-600", bg: "bg-blue-100", accent: "bg-blue-500" },
    { label: "Upcoming (Next 7 Days)", value: 0, trend: "0", trendUp: false, icon: Calendar, color: "text-emerald-600", bg: "bg-emerald-100", accent: "bg-emerald-500" },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Leave Administration</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Manage company-wide leave requests and track absenteeism.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode("table")} className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("calendar")} className={`p-1.5 rounded-md transition-colors ${viewMode === "calendar" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          {!isAdmin && (
            <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-9 px-4 shadow-sm text-sm text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Apply Leave
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {hrStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 ${stat.accent} group-hover:w-full transition-all duration-500 ease-out`} />

            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className={`p-2 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ease-out`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm transition-colors duration-300 ${stat.trendUp ? 'bg-green-50 text-green-700 border-green-200 group-hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 group-hover:bg-red-100'}`}>
                {stat.trend}
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors duration-300">{stat.value}</p>
              <p className="text-[11px] md:text-xs font-semibold text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {viewMode === "calendar" ? (
        <LeaveCalendar leaves={allRequests} isHR={true} />
      ) : (
        <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 px-5 py-4 bg-white flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-800">All Leave Applications</CardTitle>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees..."
                className="w-full pl-9 pr-4 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 font-bold tracking-wider">Employee</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Leave Type</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Duration</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Days</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Applied On</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Reason</th>
                    <th className="px-5 py-3 font-bold tracking-wider text-right">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500 font-medium">Loading leave requests...</td></tr>
                  ) : allRequests.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500 font-medium">No leave requests found.</td></tr>
                  ) : allRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{req.fullName}</p>
                        <p className="text-xs font-medium text-slate-500">{req.department}</p>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-600">
                        <Badge variant="outline" className="font-medium text-[10px] text-slate-600 bg-slate-50">{req.leaveType}</Badge>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-600">
                        {formatDate(req.startDate)} - {formatDate(req.endDate)}
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-800">{req.days}</td>
                      <td className="px-5 py-3 font-medium text-slate-500">{formatTimestamp(req.appliedOn)}</td>
                      <td className="px-5 py-3 max-w-[180px]">
                        <p
                          title={req.reason}
                          className="text-sm text-slate-600 font-medium truncate max-w-[160px]"
                        >
                          {req.reason || <span className="text-slate-400 italic text-xs">No reason given</span>}
                        </p>
                      </td>
                      <td className="px-5 py-3 flex items-center justify-end gap-2">
                        {req.status === "Pending" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(req.id!, "Approved")}
                              className="h-7 w-7 p-0 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(req.id!, "Rejected")}
                              className="h-7 w-7 p-0 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="secondary" className={
                            req.status === "Approved"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }>
                            {req.status}
                          </Badge>
                        )}
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
