"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  CalendarDays,
  Clock,
  Download,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  ChevronDown
} from "lucide-react";
import {
  getUserAttendanceForMonth,
  getTodayAttendance,
  checkIn,
  checkOut,
  updateWorkingSeconds,
  computeWorkedSeconds,
  formatAttendanceTime,
  getISTYearMonth,
  getRecentMonthOptions,
  AttendanceRecord
} from "@/lib/attendance";

const formatTime = formatAttendanceTime;

const formatDuration = (totalSeconds: number) => {
  if (!totalSeconds) return "-";
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Present": return <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-200">Present</Badge>;
    case "Checked In": return <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-200">Clocked In</Badge>;
    case "Leave": return <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-orange-200">Leave</Badge>;
    case "WFH": return <Badge variant="info" className="bg-blue-50 text-blue-600 border-blue-200">WFH</Badge>;
    case "Absent": return <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200">Absent</Badge>;
    case "Late": return <Badge variant="warning" className="bg-amber-50 text-amber-600 border-amber-200">Late</Badge>;
    case "Week Off": return <Badge variant="outline" className="bg-slate-50 text-slate-500">Week Off</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const employeeStats = [
  { title: "Attendance Rate", value: "-", trend: "-", trendUp: true, icon: TrendingUp, color: "text-green-600", bg: "bg-green-100", accent: "bg-green-500" },
  { title: "Avg. Login Time", value: "-", trend: "-", trendUp: true, icon: Clock, color: "text-blue-600", bg: "bg-blue-100", accent: "bg-blue-500" },
  { title: "Avg. Logout Time", value: "-", trend: "-", trendUp: true, icon: Clock, color: "text-purple-600", bg: "bg-purple-100", accent: "bg-purple-500" },
  { title: "Late Arrivals", value: "-", trend: "-", trendUp: true, icon: TrendingDown, color: "text-red-600", bg: "bg-red-100", accent: "bg-red-500" },
];

export default function EmployeeAttendanceDashboard() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  // Built from the current Indian month rather than a fixed list, and holding
  // the "2026-08" value the query needs instead of a display label.
  const months = useMemo(() => getRecentMonthOptions(12), []);
  const [selectedMonth, setSelectedMonth] = useState(getISTYearMonth);
  const selectedMonthLabel =
    months.find((m) => m.value === selectedMonth)?.label ?? selectedMonth;
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Clock-in/out state
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);

  // Clock status
  const isNotClockedIn = !todayRecord;
  const isClockedIn = todayRecord?.status === "Checked In";
  const isClockedOut = todayRecord?.status === "Present";

  // Fetch today's attendance
  useEffect(() => {
    if (!profile?.uid) return;
    getTodayAttendance(profile.uid).then((rec) => {
      setTodayRecord(rec);
      if (rec && rec.status === "Checked In" && rec.checkInTime) {
        setLiveSeconds(computeWorkedSeconds(rec));
      } else if (rec) {
        setLiveSeconds(rec.workingSeconds || 0);
      }
    });
  }, [profile]);

  // Live timer
  useEffect(() => {
    if (!isClockedIn) return;
    const interval = setInterval(() => {
      if (todayRecord?.checkInTime) {
        setLiveSeconds(computeWorkedSeconds(todayRecord));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isClockedIn, todayRecord]);

  // Update Firestore working seconds every 30 seconds
  useEffect(() => {
    if (!isClockedIn || !todayRecord?.id) return;
    const interval = setInterval(() => {
      updateWorkingSeconds(todayRecord.id!, liveSeconds);
    }, 30000);
    return () => clearInterval(interval);
  }, [isClockedIn, todayRecord, liveSeconds]);

  const handleClockIn = async () => {
    if (!profile?.uid) return;
    setClockLoading(true);
    const rec = await checkIn(profile.uid, profile.fullName, profile.role);
    setTodayRecord(rec);
    setLiveSeconds(0);
    setClockLoading(false);
  };

  const handleClockOut = async () => {
    if (!profile?.uid || !todayRecord?.id) return;
    setClockLoading(true);
    await checkOut(todayRecord.id, liveSeconds);
    setTodayRecord({ ...todayRecord, status: "Present", workingSeconds: liveSeconds });
    setClockLoading(false);
  };

  const formatLiveTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!profile?.uid) return;
      setLoading(true);

      const fetched = await getUserAttendanceForMonth(profile.uid, selectedMonth);
      setRecords(fetched);
      setLoading(false);
    };

    fetchRecords();
  }, [profile, selectedMonth]);

  const displayRecords = records.filter(r =>
    r.date.includes(searchTerm) || r.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Attendance Management</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Track your daily attendance, working hours, and history.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-auto" ref={dropdownRef}>
            <Button
              variant="outline"
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="w-full bg-white text-slate-700 rounded-xl shadow-sm hover:bg-slate-50 hover:text-slate-900 border-slate-200"
            >
              <CalendarDays className="h-4 w-4 mr-2 text-slate-500" />
              {selectedMonthLabel}
              <ChevronDown className={`h-4 w-4 ml-2 text-slate-400 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isMonthDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg shadow-slate-200/50 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                {months.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => {
                      setSelectedMonth(m.value);
                      setIsMonthDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors ${selectedMonth === m.value ? "text-blue-600 bg-blue-50/50" : "text-slate-600"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {/* Premium Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {employeeStats.map((stat, i) => (
          <motion.div
            key={stat.title}
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
              <p className="text-[11px] md:text-xs font-semibold text-slate-500 mt-0.5">{stat.title}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Data Table Area */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-white px-5 py-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-lg font-bold text-slate-800">Attendance Log</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="bg-white text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 hover:text-slate-900 border-slate-200 py-2 h-auto text-sm">
                  <Filter className="h-3.5 w-3.5 mr-2 text-slate-500" /> Filter
                </Button>
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
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">Loading attendance...</td>
                    </tr>
                  ) : displayRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">No attendance records found for this period.</td>
                    </tr>
                  ) : (
                    displayRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group cursor-default">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{record.date}</div>
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
                          {getStatusBadge(record.status)}
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
  );
}
