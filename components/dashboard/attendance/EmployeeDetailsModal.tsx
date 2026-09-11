"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Search,
  TrendingUp,
  TrendingDown,
  X,
  Calendar,
  Filter
} from "lucide-react";
import {
  getUserAttendanceForMonth,
  formatAttendanceTime,
  getISTYearMonth,
  getRecentMonthOptions,
  parseTimestamp,
  istParts,
  AttendanceRecord
} from "@/lib/attendance";

const formatTime = formatAttendanceTime;

const formatDuration = (totalSeconds: number) => {
  if (!totalSeconds) return "-";
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
};

const getStatusBadge = (status: string, isHalfDay?: boolean, isLate?: boolean) => {
  if (isHalfDay) {
    return <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200">Half Day</Badge>;
  }

  switch (status) {
    case "Present": return <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-200">Present</Badge>;
    case "Checked In": return <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-200">Clocked In</Badge>;
    case "Holiday (Paid)": return <Badge variant="info" className="bg-purple-50 text-purple-600 border-purple-200">Holiday</Badge>;
    case "Leave": return <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-orange-200">Leave</Badge>;
    case "WFH": return <Badge variant="info" className="bg-blue-50 text-blue-600 border-blue-200">WFH</Badge>;
    case "Absent": return <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200">Absent</Badge>;
    case "Late": return <Badge variant="warning" className="bg-amber-50 text-amber-600 border-amber-200">Late</Badge>;
    case "Week Off": return <Badge variant="outline" className="bg-slate-50 text-slate-500">Week Off</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const employeeStatsTemplate = [
  { title: "Attendance Rate", icon: TrendingUp, color: "text-green-600", bg: "bg-green-100", accent: "bg-green-500" },
  { title: "Avg. Login Time", icon: Clock, color: "text-blue-600", bg: "bg-blue-100", accent: "bg-blue-500" },
  { title: "Avg. Logout Time", icon: Clock, color: "text-purple-600", bg: "bg-purple-100", accent: "bg-purple-500" },
  { title: "Late Arrivals", icon: TrendingDown, color: "text-red-600", bg: "bg-red-100", accent: "bg-red-500" },
];

export default function EmployeeDetailsModal({ 
  employee, 
  onClose 
}: { 
  employee: { id: string, name: string }, 
  onClose: () => void 
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "late">("all");
  const [selectedMonth, setSelectedMonth] = useState(getISTYearMonth());
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const monthOptions = useMemo(() => getRecentMonthOptions(6), []);

  useEffect(() => {
    setLoading(true);
    getUserAttendanceForMonth(employee.id, selectedMonth).then((data) => {
      // Sort the records by date descending so the most recent is at the top
      setMonthRecords(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    });
  }, [employee.id, selectedMonth]);

  const stats = useMemo(() => {
    const effectiveRecords = [...monthRecords];

    // 1. Attendance Rate
    const workingDays = effectiveRecords.filter(r => r.status !== "Week Off");
    const presentDays = workingDays.filter(r => r.status === "Present" || r.status === "Checked In" || r.status === "Holiday (Paid)" || r.status === "WFH");
    const attendanceRate = workingDays.length > 0
      ? `${Math.round((presentDays.length / workingDays.length) * 100)}%`
      : "-";

    // 2. Avg. Login Time
    const checkInRecords = effectiveRecords.filter(r => r.checkInTime);
    let avgLoginTime = "-";
    if (checkInRecords.length > 0) {
      let totalMinutes = 0;
      let validCount = 0;
      checkInRecords.forEach(r => {
        const d = parseTimestamp(r.checkInTime);
        if (d) {
          const p = istParts(d);
          totalMinutes += Number(p.hour) * 60 + Number(p.minute);
          validCount++;
        }
      });
      if (validCount > 0) {
        const avgMins = Math.round(totalMinutes / validCount);
        const avgHour24 = Math.floor(avgMins / 60) % 24;
        const avgMin = avgMins % 60;
        const period = avgHour24 >= 12 ? "PM" : "AM";
        const avgHour12 = avgHour24 % 12 || 12;
        avgLoginTime = `${String(avgHour12).padStart(2, '0')}:${String(avgMin).padStart(2, '0')} ${period}`;
      }
    }

    // 3. Avg. Logout Time
    const checkOutRecords = effectiveRecords.filter(r => r.checkOutTime);
    let avgLogoutTime = "-";
    if (checkOutRecords.length > 0) {
      let totalMinutes = 0;
      let validCount = 0;
      checkOutRecords.forEach(r => {
        const d = parseTimestamp(r.checkOutTime);
        if (d) {
          const p = istParts(d);
          totalMinutes += Number(p.hour) * 60 + Number(p.minute);
          validCount++;
        }
      });
      if (validCount > 0) {
        const avgMins = Math.round(totalMinutes / validCount);
        const avgHour24 = Math.floor(avgMins / 60) % 24;
        const avgMin = avgMins % 60;
        const period = avgHour24 >= 12 ? "PM" : "AM";
        const avgHour12 = avgHour24 % 12 || 12;
        avgLogoutTime = `${String(avgHour12).padStart(2, '0')}:${String(avgMin).padStart(2, '0')} ${period}`;
      }
    }

    // 4. Late Arrivals
    const lateArrivals = effectiveRecords.filter(r => r.isLate).length.toString();

    return {
      attendanceRate,
      avgLoginTime,
      avgLogoutTime,
      lateArrivals
    };
  }, [monthRecords]);

  const displayRecords = monthRecords.filter(record => {
    const matchesSearch = record.date.includes(searchTerm) || record.status.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "late" ? record.isLate === true : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" 
        onClick={onClose}
      >
        <motion.div 
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl h-full bg-slate-50 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-white px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{employee.name}'s Attendance</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Detailed historical metrics and log</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                   <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {employeeStatsTemplate.map((stat, i) => {
                let val = "-";
                if (stat.title === "Attendance Rate") val = stats.attendanceRate;
                if (stat.title === "Avg. Login Time") val = stats.avgLoginTime;
                if (stat.title === "Avg. Logout Time") val = stats.avgLogoutTime;
                if (stat.title === "Late Arrivals") val = stats.lateArrivals;

                const isLateFilter = stat.title === "Late Arrivals";
                const isActive = isLateFilter && activeFilter === "late";

                return (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
                    onClick={() => {
                      if (isLateFilter) {
                        setActiveFilter(prev => prev === "late" ? "all" : "late");
                      }
                    }}
                    className={`bg-white rounded-2xl p-4 border shadow-sm relative overflow-hidden group transition-all ${
                      isLateFilter ? "cursor-pointer hover:shadow-md" : ""
                    } ${
                      isActive ? "border-red-500 ring-1 ring-red-500" : "border-slate-100"
                    }`}
                  >
                    <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-1 ${stat.accent} transition-all duration-500 ease-out ${isActive ? "w-full" : "w-0 group-hover:w-full"}`} />
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                        <stat.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{val}</p>
                      <p className="text-[10px] md:text-xs font-semibold text-slate-500 mt-1">{stat.title}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Table */}
            <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-white px-5 py-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle className="text-base font-bold text-slate-800">Attendance Log</CardTitle>
                  <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search records..."
                      className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder:text-slate-400"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 font-bold tracking-wider">Date</th>
                        <th className="px-5 py-3 font-bold tracking-wider">Clock In</th>
                        <th className="px-5 py-3 font-bold tracking-wider">Clock Out</th>
                        <th className="px-5 py-3 font-bold tracking-wider">Work Hrs</th>
                        <th className="px-5 py-3 font-bold tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-medium">Loading attendance...</td>
                        </tr>
                      ) : displayRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-medium">No attendance records found for this period.</td>
                        </tr>
                      ) : (
                        displayRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="font-bold text-slate-800">{record.date}</div>
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap font-semibold text-slate-600">
                              {formatTime(record.checkInTime)}
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap font-semibold text-slate-600">
                              {formatTime(record.checkOutTime)}
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="font-bold text-slate-800">{formatDuration(record.workingSeconds)}</div>
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              {getStatusBadge(record.status, record.isHalfDay, record.isLate)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
