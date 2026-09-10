"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Clock, Palmtree, Users, Wallet, Activity } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTodayAttendance, computeWorkedSeconds, getLocalDateString } from "@/lib/attendance";
import { getUserLeaves, calculateAccruedLeaves } from "@/lib/leave";
import { getEmployeePayrolls } from "@/lib/payroll";

export default function TopStats() {
  const { profile } = useAuth();
  const router = useRouter();
  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";
  const isAdmin = profile?.role === "Admin";
  const isHR = profile?.role === "HR" || profile?.role === "OPS_HR";

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [lateToday, setLateToday] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [attendanceStatus, setAttendanceStatus] = useState("-");
  const [workingHrs, setWorkingHrs] = useState("-");
  const [leaveBalance, setLeaveBalance] = useState("-");
  const [salaryStatus, setSalaryStatus] = useState("Pending");
  const [salarySubtitle, setSalarySubtitle] = useState(new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }));

  useEffect(() => {
    if (!profile || !isAdminOrHR) return;

    const supabase = createClient();

    const fetchCounts = async () => {
      const todayDate = getLocalDateString();
      const [profilesRes, attRes] = await Promise.all([
        supabase.from("profiles").select("id, status").neq("role", "Admin"),
        supabase.from("attendance").select("user_id, status, is_late").eq("date", todayDate)
      ]);

      const profiles = profilesRes.data || [];
      const attendance = attRes.data || [];

      setTotalEmployees(profiles.length);

      let onLeave = 0;
      profiles.forEach((p) => {
        if (p.status === "On Leave") onLeave++;
      });
      setOnLeaveToday(onLeave);

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      attendance.forEach(record => {
        if (record.status === "Present" || record.status === "Checked In") {
          presentCount++;
        }
        if (record.is_late) {
          lateCount++;
        }
        if (record.status === "Absent") {
          absentCount++;
        }
      });

      setPresentToday(presentCount);
      setLateToday(lateCount);
      setAbsentToday(absentCount);
    };

    fetchCounts();

    const profileChannel = supabase
      .channel(`profiles_count_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchCounts)
      .subscribe();

    const attChannel = supabase
      .channel(`att_count_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, fetchCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(attChannel);
    };
  }, [profile, isAdminOrHR]);

  useEffect(() => {
    if (!profile?.uid) return;

    let intervalId: NodeJS.Timeout;

    // Get today's attendance
    getTodayAttendance(profile.uid).then((record) => {
      if (record) {
        setAttendanceStatus(record.status === "Present" ? "Present" : record.status === "Checked In" ? "Clocked In" : record.status);
        
        const updateWorkingTime = () => {
          const secs = computeWorkedSeconds(record);
          if (secs > 0) {
            const hrs = Math.floor(secs / 3600);
            const mins = Math.floor((secs % 3600) / 60);
            setWorkingHrs(`${hrs}h ${mins}m`);
          }
        };

        updateWorkingTime();

        if (record.status === "Checked In") {
          intervalId = setInterval(updateWorkingTime, 60000);
        }
      }
    });

    // Get leave balance
    getUserLeaves(profile.uid).then((leaves) => {
      const totalUsed = leaves.filter((l) => l.status === "Approved" && l.leaveType !== "Manual Credit" && l.leaveType !== "Manual Deduction").reduce((s, l) => s + l.days, 0);
      const totalAccrued = calculateAccruedLeaves(profile.dateOfJoining, leaves);
      const totalAvailable = totalAccrued - totalUsed;
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

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [profile]);

  if (isAdmin) {
    const adminCards = [
      {
        title: "Total Headcount",
        value: totalEmployees.toString(),
        subtitle: "Active Employees",
        icon: Users,
        color: "text-blue-600",
        bg: "bg-blue-100/50",
        accent: "bg-blue-500",
        href: "/dashboard/employees"
      },
      {
        title: "Present Today",
        value: presentToday.toString(),
        subtitle: "Clocked In / Present",
        icon: CalendarCheck,
        color: "text-emerald-600",
        bg: "bg-emerald-100/50",
        accent: "bg-emerald-500",
        href: "/dashboard/attendance"
      },
      {
        title: "Out of Office",
        value: (absentToday + onLeaveToday).toString(),
        subtitle: "Absent / On Leave",
        icon: Palmtree,
        color: "text-amber-600",
        bg: "bg-amber-100/50",
        accent: "bg-amber-500",
        href: "/dashboard/leave"
      },
      {
        title: "Late Arrivals",
        value: lateToday.toString(),
        subtitle: "After 7:45 PM",
        icon: Clock,
        color: "text-red-600",
        bg: "bg-red-100/50",
        accent: "bg-red-500",
        href: "/dashboard/attendance"
      }
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {adminCards.map((stat, i) => (
          <motion.div
            key={i}
            onClick={() => stat.href && router.push(stat.href)}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:shadow-slate-200/50 transition-shadow duration-300 group cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
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

  const stats = isHR
    ? [
      { title: "Total Employees", value: totalEmployees.toString(), subtitle: "Active", icon: Users, color: "text-blue-600", bg: "bg-blue-100/50", accent: "bg-blue-500", href: "/dashboard/employees" },
      { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500", href: "/dashboard/attendance" },
      { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500", href: "/dashboard/leave" },
      { title: "Salary Status", value: salaryStatus, subtitle: salarySubtitle, icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500", href: "/dashboard/payroll" },
    ]
    : [
      { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500", href: "/dashboard/attendance" },
      { title: "Total Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500", href: "/dashboard/attendance" },
      { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500", href: "/dashboard/leave" },
      { title: "Salary Status", value: salaryStatus, subtitle: salarySubtitle, icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500", href: "/dashboard/payroll" },
    ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          onClick={() => stat.href && router.push(stat.href)}
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
