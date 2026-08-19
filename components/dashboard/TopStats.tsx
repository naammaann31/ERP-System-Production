"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Clock, Palmtree, Users, Wallet, Activity } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getTodayAttendance, computeWorkedSeconds } from "@/lib/attendance";
import { getUserLeaves } from "@/lib/leave";
import { getEmployeePayrolls } from "@/lib/payroll";

export default function TopStats() {
  const { profile } = useAuth();
  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";
  const isAdmin = profile?.role === "Admin";
  const isHR = profile?.role === "HR" || profile?.role === "OPS_HR";

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [onLeaveEmployees, setOnLeaveEmployees] = useState(0);
  const [attendanceStatus, setAttendanceStatus] = useState("-");
  const [workingHrs, setWorkingHrs] = useState("-");
  const [leaveBalance, setLeaveBalance] = useState("-");
  const [salaryStatus, setSalaryStatus] = useState("Pending");
  const [salarySubtitle, setSalarySubtitle] = useState(new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }));

  useEffect(() => {
    if (!profile || !isAdminOrHR) return;

    const supabase = createClient();

    const fetchCounts = async () => {
      const { data, error } = await supabase.from("profiles").select("status").neq("role", "Admin");
      if (error) {
        console.error("Error fetching employee counts:", error);
        return;
      }
      const rows = data || [];
      setTotalEmployees(rows.length);
      let active = 0;
      let onLeave = 0;
      rows.forEach((row) => {
        if (row.status === "On Leave") onLeave++;
        else if (row.status === "Active" || !row.status) active++;
      });
      setActiveEmployees(active);
      setOnLeaveEmployees(onLeave);
    };

    fetchCounts();

    const channel = supabase
      .channel(`profiles_count_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isAdminOrHR]);

  useEffect(() => {
    if (!profile?.uid) return;

    // Get today's attendance
    getTodayAttendance(profile.uid).then((record) => {
      if (record) {
        setAttendanceStatus(record.status === "Present" ? "Present" : record.status === "Checked In" ? "Clocked In" : record.status);
        if (record.workingSeconds > 0) {
          const hrs = Math.floor(record.workingSeconds / 3600);
          const mins = Math.floor((record.workingSeconds % 3600) / 60);
          setWorkingHrs(`${hrs}h ${mins}m`);
        }
      }
    });

    // Get leave balance
    getUserLeaves(profile.uid).then((leaves) => {
      const plUsed = leaves.filter((l) => l.leaveType === "Paid Leave (PL)" && l.status === "Approved").reduce((s, l) => s + l.days, 0);
      const clUsed = leaves.filter((l) => l.leaveType === "Casual Leave" && l.status === "Approved").reduce((s, l) => s + l.days, 0);
      const totalUsed = plUsed + clUsed;
      const totalAvailable = 24 - totalUsed; // 12 PL + 12 CL = 24 total
      setLeaveBalance(totalAvailable.toString());
    });

    // Get payroll status
    getEmployeePayrolls(profile.uid).then((payrolls) => {
      if (payrolls && payrolls.length > 0) {
        const latest = payrolls[0];
        setSalaryStatus(latest.status === "Paid" ? "Done" : "Pending");
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        setSalarySubtitle(`${monthNames[latest.month - 1]} ${latest.year}`);
      }
    }).catch(console.error);
  }, [profile]);

  if (isAdmin) {
    const activePercent = totalEmployees > 0 ? (activeEmployees / totalEmployees) * 100 : 0;
    const leavePercent = totalEmployees > 0 ? (onLeaveEmployees / totalEmployees) * 100 : 0;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:shadow-slate-200/50 transition-shadow duration-300 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 bg-blue-500 group-hover:w-full transition-all duration-500 ease-out" />

          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="p-2 rounded-xl bg-blue-100/50 text-blue-600 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ease-out">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 shadow-sm">Active</span>
          </div>
          <div className="relative z-10">
            <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{totalEmployees}</p>
            <p className="text-[11px] md:text-xs font-semibold text-slate-500 mt-0.5">Total Employees</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          className="col-span-1 md:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-center hover:shadow-lg hover:shadow-slate-200/50 transition-shadow duration-300"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-100/50 text-indigo-600">
                <Activity className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Workforce Analysis</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live</span>
          </div>

          <div className="mt-1">
            <div className="flex w-full h-4 rounded-full overflow-hidden bg-slate-100 gap-1">
              <div style={{ width: `${activePercent}%` }} className="bg-emerald-500 transition-all duration-1000" />
              <div style={{ width: `${leavePercent}%` }} className="bg-amber-400 transition-all duration-1000" />
            </div>
            <div className="flex gap-8 mt-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-600">Available</span>
                </div>
                <span className="text-xl font-black text-slate-800 ml-4 mt-0.5">{activeEmployees}</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold text-slate-600">On Leave</span>
                </div>
                <span className="text-xl font-black text-slate-800 ml-4 mt-0.5">{onLeaveEmployees}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const stats = isHR
    ? [
      { title: "Total Employees", value: totalEmployees.toString(), subtitle: "Active", icon: Users, color: "text-blue-600", bg: "bg-blue-100/50", accent: "bg-blue-500" },
      { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
      { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },
      { title: "Salary Status", value: salaryStatus, subtitle: salarySubtitle, icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500" },
    ]
    : [
      { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
      { title: "Total Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },
      { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },
      { title: "Salary Status", value: salaryStatus, subtitle: salarySubtitle, icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500" },
    ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:shadow-slate-200/50 transition-shadow duration-300 group cursor-pointer relative overflow-hidden"
        >
          {/* Subtle gradient background on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          {/* Bottom accent line that expands on hover */}
          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 ${stat.accent} group-hover:w-full transition-all duration-500 ease-out`} />

          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className={`p-2 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ease-out`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 group-hover:border-slate-300 group-hover:text-slate-700 transition-colors duration-300 shadow-sm">{stat.subtitle}</span>
          </div>
          <div className="relative z-10">
            <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors duration-300">{stat.value}</p>
            <p className="text-[11px] md:text-xs font-semibold text-slate-500 mt-0.5">{stat.title}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
