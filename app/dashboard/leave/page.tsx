"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Plus, Calendar, Clock, CheckCircle2, Check, X, AlertCircle, Users, Search, Filter, ChevronDown } from "lucide-react";
import { 
  applyLeave, 
  getUserLeaves, 
  getAllPendingLeaves, 
  updateLeaveStatus,
  listenToUserLeaves,
  listenToPendingLeaves,
  listenToAllLeaves,
  LeaveRequest
} from "@/lib/leave";

// --- Formatter Helpers ---
const formatDate = (dateStr: string) => {
  // Assuming dateStr is YYYY-MM-DD
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

// --- Employee Dashboard Data & Logic ---

const initialLeaveBalances = [
  { type: "Paid Leave (PL)", total: 12, used: 0, pending: 0, icon: Calendar, color: "text-blue-500", bg: "bg-blue-50" },
  { type: "Casual Leave", total: 6, used: 0, pending: 0, icon: Clock, color: "text-orange-500", bg: "bg-orange-50" },
];

function EmployeeLeaveDashboard() {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState(initialLeaveBalances);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("Paid Leave (PL)");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const leaveOptions = ["Paid Leave (PL)", "Casual Leave", "Sick Leave"];

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);

    const unsubscribe = listenToUserLeaves(profile.uid, (fetched) => {
      setLeaves(fetched);

      const updatedBalances = initialLeaveBalances.map(bal => ({ ...bal, used: 0, pending: 0 }));
      let plUsed = 0, plPending = 0;
      let clUsed = 0, clPending = 0;

      fetched.forEach(l => {
        if (l.leaveType === "Paid Leave (PL)") {
          if (l.status === "Approved") plUsed += l.days;
          if (l.status === "Pending") plPending += l.days;
        } else if (l.leaveType === "Casual Leave") {
          if (l.status === "Approved") clUsed += l.days;
          if (l.status === "Pending") clPending += l.days;
        }
      });

      updatedBalances[0].used = plUsed;
      updatedBalances[0].pending = plPending;
      updatedBalances[1].used = clUsed;
      updatedBalances[1].pending = clPending;
      
      setBalances(updatedBalances);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    setIsSubmitting(true);

    const days = 1;

    await applyLeave(
      profile.uid,
      profile.fullName,
      profile.department || "General",
      leaveType,
      date,
      date,
      days,
      reason,
      profile.role
    );

    setIsModalOpen(false);
    setIsSubmitting(false);
    setDate("");
    setReason("");
  };

  const totalBalance = {
    type: "Total Leaves",
    total: balances[0].total + balances[1].total,
    used: balances[0].used + balances[1].used,
    pending: balances[0].pending + balances[1].pending,
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-50"
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-4 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">View your leave balance and apply for time off.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-9 px-4 shadow-sm text-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Apply Leave
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...balances, totalBalance].map((leave, i) => {
          const available = leave.total - leave.used - leave.pending;
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
                    <span className="text-3xl font-black text-slate-900 tracking-tight">{available}</span>
                    <span className="text-slate-500 text-[11px] font-semibold">/ {leave.total} days</span>
                  </div>
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
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

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
                    <td className="px-5 py-3 font-bold text-slate-800">{record.days}</td>
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

      {/* Premium Apply Leave Modal */}
      {isModalOpen && (
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
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleApplySubmit} className="p-6 space-y-5">
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
                          className={`px-4 py-3 text-sm font-semibold cursor-pointer transition-colors ${
                            leaveType === option 
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
              
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Date</label>
                <input 
                  type="date" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all uppercase"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              
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
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl border-slate-200 font-bold hover:bg-slate-50 px-6">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-6 shadow-md shadow-blue-500/20 active:scale-95 transition-all">
                  {isSubmitting ? "Applying..." : "Submit Application"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}


// --- HR Dashboard ---

function HRLeaveDashboard() {
  const { profile } = useAuth();
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("Paid Leave (PL)");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const leaveOptions = ["Paid Leave (PL)", "Casual Leave", "Sick Leave"];

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenToAllLeaves((fetched) => {
      const filtered = fetched.filter(req => {
        if (profile?.role === "HR" && (req.role === "HR" || req.role === "Admin")) {
          return false;
        }
        return true;
      });
      setAllRequests(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    setIsSubmitting(true);

    const days = 1;

    await applyLeave(
      profile.uid,
      profile.fullName,
      profile.department || "General",
      leaveType,
      date,
      date,
      days,
      reason,
      profile.role
    );

    setIsModalOpen(false);
    setIsSubmitting(false);
    setDate("");
    setReason("");
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
          <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-9 px-4 shadow-sm text-sm text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Apply Leave
          </Button>
          <Button variant="outline" className="bg-white text-slate-700 rounded-xl shadow-sm hover:bg-slate-50 hover:text-slate-900 border-slate-200 py-2 h-auto text-sm">
            <Filter className="h-4 w-4 mr-1.5 text-slate-500" /> Filter
          </Button>
          <Button className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 h-9">
            Generate Report
          </Button>
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
                  <th className="px-5 py-3 font-bold tracking-wider text-right">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 font-medium">Loading leave requests...</td></tr>
                ) : allRequests.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 font-medium">No leave requests found.</td></tr>
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
      
      {/* Premium Apply Leave Modal */}
      {isModalOpen && (
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
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleApplySubmit} className="p-6 space-y-5">
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
                          className={`px-4 py-3 text-sm font-semibold cursor-pointer transition-colors ${
                            leaveType === option 
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
              
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Date</label>
                <input 
                  type="date" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all uppercase"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              
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
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl border-slate-200 font-bold hover:bg-slate-50 px-6">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-6 shadow-md shadow-blue-500/20 active:scale-95 transition-all text-white">
                  {isSubmitting ? "Applying..." : "Submit Application"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- Main Page Component ---

export default function LeavePage() {
  const { profile } = useAuth();
  
  if (profile?.role === "HR" || profile?.role === "Admin") {
    return <HRLeaveDashboard />;
  }

  return <EmployeeLeaveDashboard />;
}
