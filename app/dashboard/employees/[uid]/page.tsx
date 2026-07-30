"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, Variants } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  CalendarCheck,
  CalendarOff,
  Wallet,
  Clock,
  BadgeCheck,
  Hash,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserAttendanceForMonth, AttendanceRecord } from "@/lib/attendance";
import { getUserLeaves, LeaveRequest } from "@/lib/leave";
import { getEmployeePayrolls, PayrollRecord } from "@/lib/payroll";

interface EmployeeData {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  designation?: string;
  employeeId?: string;
  employmentType?: string;
  department?: string;
  phone?: string;
  status?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 60, damping: 18 } },
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (dateObj: any) => {
  if (!dateObj) return "-";
  if (dateObj.toDate) {
    return dateObj.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return "-";
};

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const uid = params.uid as string;

  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";

  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const fetchAll = async () => {
      setLoading(true);

      // Fetch employee data from both collections
      let empData: EmployeeData | null = null;
      let docSnap = await getDoc(doc(db, "users", uid));
      if (docSnap.exists()) {
        empData = { uid, ...docSnap.data() } as EmployeeData;
      } else {
        docSnap = await getDoc(doc(db, "Users", uid));
        if (docSnap.exists()) {
          empData = { uid, ...docSnap.data() } as EmployeeData;
        }
      }
      setEmployee(empData);

      // Fetch attendance for current month
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const attRecords = await getUserAttendanceForMonth(uid, yearMonth);
      setAttendance(attRecords);

      // Fetch leaves
      const leaveRecords = await getUserLeaves(uid);
      setLeaves(leaveRecords);

      // Fetch payrolls
      const payrollRecords = await getEmployeePayrolls(uid);
      setPayrolls(payrollRecords);

      setLoading(false);
    };

    fetchAll();
  }, [uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-slate-500 font-medium">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6 pb-6">
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="text-center py-12 text-slate-500">Employee not found.</div>
      </div>
    );
  }

  const initials = employee.fullName
    ? employee.fullName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : "?";

  const presentDays = attendance.filter((a) => a.status === "Present" || a.status === "Checked In").length;
  const approvedLeaves = leaves.filter((l) => l.status === "Approved").length;
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
  const totalLeaveDays = leaves.filter((l) => l.status === "Approved").reduce((sum, l) => sum + l.days, 0);
  const latestPayroll = payrolls.length > 0 ? payrolls[0] : null;

  const summaryCards = [
    {
      title: "Present This Month",
      value: presentDays.toString(),
      subtitle: "days",
      icon: CalendarCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-100/50",
      accent: "bg-emerald-500",
    },
    {
      title: "Leaves Taken",
      value: totalLeaveDays.toString(),
      subtitle: `${pendingLeaves} pending`,
      icon: CalendarOff,
      color: "text-amber-600",
      bg: "bg-amber-100/50",
      accent: "bg-amber-500",
    },
    {
      title: "Latest Net Salary",
      value: latestPayroll ? `₹${latestPayroll.netSalary.toLocaleString()}` : "—",
      subtitle: latestPayroll ? `${latestPayroll.month}/${latestPayroll.year}` : "No payroll",
      icon: Wallet,
      color: "text-purple-600",
      bg: "bg-purple-100/50",
      accent: "bg-purple-500",
    },
    {
      title: "Payroll Status",
      value: latestPayroll ? latestPayroll.status : "—",
      subtitle: latestPayroll ? "Current" : "N/A",
      icon: BadgeCheck,
      color: "text-blue-600",
      bg: "bg-blue-100/50",
      accent: "bg-blue-500",
    },
  ];

  const infoFields = [
    { label: "Full Name", value: employee.fullName, icon: User },
    { label: "Email", value: employee.email, icon: Mail },
    { label: "Employee ID", value: employee.employeeId || "N/A", icon: Hash },
    { label: "Department", value: employee.role === "OPS_HR" ? "HR" : (employee.department || employee.role || "General"), icon: Building2 },
    { label: "Designation", value: employee.designation || "N/A", icon: Briefcase },
    { label: "Employment Type", value: employee.employmentType || "Full-Time", icon: Clock },
  ];

  return (
    <motion.div
      className="max-w-[1400px] mx-auto space-y-5 pb-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Back button */}
      <motion.div variants={itemVariants}>
        <button onClick={() => router.push('/dashboard/employees')} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Employees
        </button>
      </motion.div>

      {/* Profile Header */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-800 via-blue-700 to-violet-800 px-6 py-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white font-black text-2xl border border-white/20 shadow-lg">
                {initials}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-black text-white tracking-tight">{employee.fullName}</h1>
                <p className="text-slate-300 text-sm font-medium mt-1">{employee.designation || "Employee"} · {employee.role === "OPS_HR" ? "HR" : (employee.department || employee.role)}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge className="bg-white/15 text-white border-white/20 backdrop-blur-sm font-semibold text-[10px]">
                    {employee.employeeId || "N/A"}
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 backdrop-blur-sm font-semibold text-[10px]">
                    {employee.status || "Active"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {summaryCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            variants={itemVariants}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 ${stat.accent} group-hover:w-full transition-all duration-500 ease-out`} />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className={`p-2 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ease-out`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 shadow-sm">{stat.subtitle}</span>
            </div>
            <div className="relative z-10">
              <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{stat.value}</p>
              <p className="text-[11px] md:text-xs font-semibold text-slate-500 mt-0.5">{stat.title}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Personal Info + Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal Information */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden h-full">
            <CardHeader className="border-b border-slate-100 px-5 py-4 bg-white">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <User className="h-5 w-5 text-slate-400" /> Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {infoFields.map((field) => (
                  <div key={field.label} className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-50 text-slate-400 shrink-0">
                      <field.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{field.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Attendance */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden h-full">
            <CardHeader className="border-b border-slate-100 px-5 py-4 bg-white">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-slate-400" /> Attendance This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="px-5 py-3 font-bold tracking-wider">Date</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Clock In</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Clock Out</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-slate-400 font-medium text-sm">No attendance records this month.</td>
                      </tr>
                    ) : (
                      attendance.slice(0, 15).map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-2.5 font-semibold text-slate-800 text-xs">{r.date}</td>
                          <td className="px-5 py-2.5 text-slate-600 text-xs">{formatTime(r.checkInTime)}</td>
                          <td className="px-5 py-2.5 text-slate-600 text-xs">{formatTime(r.checkOutTime)}</td>
                          <td className="px-5 py-2.5">
                            <Badge
                              variant={r.status === "Present" || r.status === "Checked In" ? "success" : "secondary"}
                              className="font-semibold text-[10px] py-0.5"
                            >
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Leave History + Payroll History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leave History */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden h-full">
            <CardHeader className="border-b border-slate-100 px-5 py-4 bg-white">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-slate-400" /> Leave History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="px-5 py-3 font-bold tracking-wider">Type</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Duration</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Days</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {leaves.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-slate-400 font-medium text-sm">No leave records.</td>
                      </tr>
                    ) : (
                      leaves.slice(0, 10).map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-2.5 font-semibold text-slate-800 text-xs">{l.leaveType}</td>
                          <td className="px-5 py-2.5 text-slate-600 text-xs">{formatDate(l.startDate)} – {formatDate(l.endDate)}</td>
                          <td className="px-5 py-2.5 font-bold text-slate-800 text-xs">{l.days}</td>
                          <td className="px-5 py-2.5">
                            <Badge
                              variant={l.status === "Approved" ? "success" : l.status === "Rejected" ? "destructive" : "warning"}
                              className="font-semibold text-[10px] py-0.5"
                            >
                              {l.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payroll History */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden h-full">
            <CardHeader className="border-b border-slate-100 px-5 py-4 bg-white">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-slate-400" /> Payroll History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="px-5 py-3 font-bold tracking-wider">Period</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Gross</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Net</th>
                      <th className="px-5 py-3 font-bold tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {payrolls.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-slate-400 font-medium text-sm">No payroll records.</td>
                      </tr>
                    ) : (
                      payrolls.slice(0, 10).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-2.5 font-semibold text-slate-800 text-xs">{p.month}/{p.year}</td>
                          <td className="px-5 py-2.5 text-slate-600 text-xs">₹{p.grossSalary.toLocaleString()}</td>
                          <td className="px-5 py-2.5 font-bold text-emerald-700 text-xs">₹{p.netSalary.toLocaleString()}</td>
                          <td className="px-5 py-2.5">
                            <Badge
                              variant={p.status === "Paid" ? "success" : "warning"}
                              className="font-semibold text-[10px] py-0.5"
                            >
                              {p.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
