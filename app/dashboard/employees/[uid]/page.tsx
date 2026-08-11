"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, Variants, AnimatePresence } from "framer-motion";
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
  Megaphone,
  LineChart,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserAttendanceForMonth, AttendanceRecord } from "@/lib/attendance";
import { getUserLeaves, LeaveRequest } from "@/lib/leave";
import { getEmployeePayrolls, PayrollRecord } from "@/lib/payroll";
import MarketingClient from "@/components/dashboard/MarketingClient";
import SalesDataSection from "@/components/dashboard/departments/SalesDataSection";

interface EmployeeData {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  jobRole?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  phone?: string;
  status?: string;
  aadhar?: string;
  pan?: string;
  bankAccountName?: string;
  bankDetails?: string;
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

const formatTime = (isoString: string | null) => {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
};

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const uid = params.uid as string;

  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";
  // A Team-Lead viewing a teammate's profile (not Admin/HR, and not their
  // own profile) only gets the leads section — no personal/attendance/
  // leave/payroll data, which is Admin/HR-only.
  const isTeamLeadViewingOther =
    !isAdminOrHR && profile?.designation === "Team-Lead" && profile?.uid !== uid;

  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [openCards, setOpenCards] = useState({
    personalInfo: false,
    attendance: false,
    leave: false,
    payroll: false,
  });

  const toggleCard = (key: keyof typeof openCards) => {
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!uid) return;

    const fetchAll = async () => {
      setLoading(true);

      // Fetch employee data from 'profiles' table
      let empData: EmployeeData | null = null;
      const supabase = createClient();
      const { data: row } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (row) {
        empData = {
          uid: row.id,
          fullName: row.full_name,
          email: row.email,
          role: row.role,
          jobRole: row.job_role,
          employeeId: row.employee_id,
          designation: row.designation,
          department: row.department,
          phone: row.phone,
          status: row.status,
          aadhar: row.aadhar,
          pan: row.pan,
          bankAccountName: row.bank_account_name,
          bankDetails: row.bank_details,
        } as EmployeeData;
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
    { label: "Phone", value: employee.phone || "Not provided", icon: Phone },
    { label: "Employee ID", value: employee.employeeId || "N/A", icon: Hash },
    { label: "Department", value: employee.role === "OPS_HR" ? "HR" : (employee.department || employee.role || "General"), icon: Building2 },
    { label: "Job Role", value: employee.jobRole || "N/A", icon: Briefcase },
    { label: "Designation", value: employee.designation || "Employee", icon: Clock },
  ];

  const statutoryFields = [
    { label: "Aadhar Number", value: employee.aadhar || "Not provided" },
    { label: "PAN Number", value: employee.pan || "Not provided" },
    { label: "Bank Account Name", value: employee.bankAccountName || "Not provided" },
    { label: "Bank Details", value: employee.bankDetails || "Not provided" },
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
        <button onClick={() => {
            if (profile?.designation === "Team-Lead" || profile?.jobRole === "Team-Lead") {
                router.push('/dashboard/my-team');
            } else {
                router.push('/dashboard/employees');
            }
        }} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm w-fit">
          <ArrowLeft className="h-4 w-4" /> {profile?.designation === "Team-Lead" || profile?.jobRole === "Team-Lead" ? "Back to My Team" : "Back to Employees"}
        </button>
      </motion.div>

      {/* Profile Header */}
      <motion.div variants={itemVariants}>
        <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
          <div className="px-6 py-8 flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 font-bold text-2xl border border-slate-200 shadow-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{employee.fullName}</h1>
              <p className="text-slate-500 text-sm font-medium mt-1">{employee.jobRole || "Employee"} · {employee.role === "OPS_HR" ? "HR" : (employee.department || employee.role)}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50 font-medium text-[10px]">
                  {employee.employeeId || "N/A"}
                </Badge>
                <Badge className={`border-0 font-medium text-[10px] ${employee.status === 'Active' || !employee.status ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
                  {employee.status || "Active"}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Summary Cards */}
      {!isTeamLeadViewingOther && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {summaryCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            variants={itemVariants}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100 text-slate-500">{stat.subtitle}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
              <p className="text-sm font-medium text-slate-500 mt-0.5">{stat.title}</p>
            </div>
          </motion.div>
        ))}
      </div>
      )}

      {/* Personal Info + Attendance */}
      {!isTeamLeadViewingOther && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Personal Information */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <CardHeader 
              className="border-b border-slate-100 px-5 py-4 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleCard('personalInfo')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <User className="h-5 w-5 text-slate-400" /> Personal Information
                </CardTitle>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${openCards.personalInfo ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
            <AnimatePresence initial={false}>
              {openCards.personalInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <CardContent className="p-5 flex-1">
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

                    {/* Statutory Details Section */}
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Statutory & Bank Details</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {statutoryFields.map((field) => (
                          <div key={field.label} className="bg-slate-50 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</p>
                            <p className="text-sm font-medium text-slate-800 mt-0.5">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Recent Attendance */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <CardHeader 
              className="border-b border-slate-100 px-5 py-4 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleCard('attendance')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-slate-400" /> Attendance This Month
                </CardTitle>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${openCards.attendance ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
            <AnimatePresence initial={false}>
              {openCards.attendance && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <CardContent className="p-0 flex-1">
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
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>
      )}

      {/* Leave History + Payroll History */}
      {!isTeamLeadViewingOther && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Leave History */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <CardHeader 
              className="border-b border-slate-100 px-5 py-4 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleCard('leave')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <CalendarOff className="h-5 w-5 text-slate-400" /> Leave History
                </CardTitle>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${openCards.leave ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
            <AnimatePresence initial={false}>
              {openCards.leave && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <CardContent className="p-0 flex-1">
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
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Payroll History */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <CardHeader 
              className="border-b border-slate-100 px-5 py-4 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleCard('payroll')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-slate-400" /> Payroll History
                </CardTitle>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${openCards.payroll ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
            <AnimatePresence initial={false}>
              {openCards.payroll && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <CardContent className="p-0 flex-1">
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
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>
      )}

      {/* Marketing Leads Section - Hidden from HR */}
      {employee.role === "MARKETING" && profile?.role !== "HR" && profile?.role !== "OPS_HR" && (
        <motion.div variants={itemVariants}>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-500" />
              Marketing Leads by {employee.fullName}
            </h3>
            <p className="text-sm text-slate-500 mt-1">All marketing candidates and records generated by this employee.</p>
          </div>
          <MarketingClient filterByUid={uid} filterByName={employee.fullName} />
        </motion.div>
      )}

      {/* Sales Leads Section - Hidden from HR */}
      {employee.role === "SALES" && profile?.role !== "HR" && profile?.role !== "OPS_HR" && (
        <motion.div variants={itemVariants}>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <LineChart className="h-5 w-5 text-emerald-500" />
              Sales Leads by {employee.fullName}
            </h3>
            <p className="text-sm text-slate-500 mt-1">All sales candidates and records generated by this employee.</p>
          </div>
          <SalesDataSection filterByName={employee.fullName} />
        </motion.div>
      )}
    </motion.div>
  );
}

