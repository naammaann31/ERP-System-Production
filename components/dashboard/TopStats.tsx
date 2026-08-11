"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Clock, Palmtree, Users, Wallet } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getTodayAttendance } from "@/lib/attendance";
import { getUserLeaves } from "@/lib/leave";

export default function TopStats() {
  const { profile } = useAuth();
  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [attendanceStatus, setAttendanceStatus] = useState("-");
  const [workingHrs, setWorkingHrs] = useState("-");
  const [leaveBalance, setLeaveBalance] = useState("-");

  useEffect(() => {
    if (!profile || !isAdminOrHR) return;

    const supabase = createClient();

    const fetchCount = async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      setTotalEmployees(count || 0);
    };

    fetchCount();

    const channel = supabase
      .channel(`profiles_count_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchCount)
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
      const totalAvailable = 18 - totalUsed; // 12 PL + 6 CL = 18 total
      setLeaveBalance(totalAvailable.toString());
    });
  }, [profile]);

  const stats = isAdminOrHR
    ? [
        { title: "Total Employees", value: totalEmployees.toString(), subtitle: "Active", icon: Users, color: "text-blue-600", bg: "bg-blue-100/50", accent: "bg-blue-500" },
        { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
        { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },
        { title: "Salary Status", value: "Pending", subtitle: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500" },
      ]
    : [
        { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
        { title: "Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },
        { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },
        { title: "Salary Status", value: "Pending", subtitle: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500" },
      ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group cursor-pointer relative overflow-hidden"
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
