"use client";

import { useState, useEffect } from "react";
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
  UserCheck,
  UserX,
  UserMinus
} from "lucide-react";
import {
  getAttendanceByDate,
  formatAttendanceTime,
  getLocalDateString,
  AttendanceRecord
} from "@/lib/attendance";

const formatTime = formatAttendanceTime;

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

const hrStats = [
  { title: "Total Present Today", value: "0", trend: "0", trendUp: true, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-100", accent: "bg-emerald-500" },
  { title: "Total Absent", value: "0", trend: "0", trendUp: true, icon: UserX, color: "text-red-600", bg: "bg-red-100", accent: "bg-red-500" },
  { title: "On Leave", value: "0", trend: "0", trendUp: true, icon: UserMinus, color: "text-amber-600", bg: "bg-amber-100", accent: "bg-amber-500" },
  { title: "Late Arrivals", value: "0", trend: "0", trendUp: false, icon: Clock, color: "text-orange-600", bg: "bg-orange-100", accent: "bg-orange-500" },
];

export default function HRAttendanceDashboard() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  // Indian calendar date, matching how attendance rows are filed.
  // toISOString() would give the UTC date, which before 05:30 IST is still
  // YESTERDAY — so an early-morning shift showed an empty table because it
  // was querying the wrong day.
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      const fetched = await getAttendanceByDate(selectedDate);
      setRecords(fetched);
      setLoading(false);
    };

    fetchRecords();
  }, [selectedDate]);

  const filteredEmployees = records.filter(emp => {
    return emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.status.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const exportToCSV = () => {
    if (filteredEmployees.length === 0) return;
    const headers = ["Employee", "Date", "Clock In", "Clock Out", "Status"];
    const csvRows = [headers.join(",")];

    filteredEmployees.forEach(emp => {
      const row = [
        `"${emp.fullName}"`,
        `="${emp.date}"`, // Force Excel to treat as text to prevent ########
        `"${formatTime(emp.checkInTime)}"`,
        `"${formatTime(emp.checkOutTime)}"`,
        `"${emp.status}"`
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-4">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Organization Attendance</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Monitor daily company-wide attendance and shifts.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 h-9 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          </div>
          <Button onClick={exportToCSV} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 h-9">
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
        </div>
      </div>

      {/* Premium Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {hrStats.map((stat, i) => {
          let val = stat.value;
          if (stat.title === "Total Present Today") {
            val = records.length.toString();
          }

          return (
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
                <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors duration-300">{val}</p>
                <p className="text-[11px] md:text-xs font-semibold text-slate-500 mt-0.5">{stat.title}</p>
              </div>
            </motion.div>
          );
        })}
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
              <CardTitle className="text-lg font-bold text-slate-800">Today's Employee Attendance</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search employee..."
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
                    <th className="px-5 py-3 font-bold tracking-wider">Employee</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Date</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Clock In</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Clock Out</th>
                    <th className="px-5 py-3 font-bold tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">Loading attendance records...</td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">No employees found.</td>
                    </tr>
                  ) : (
                    filteredEmployees.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group cursor-default">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{record.fullName}</div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="font-medium text-slate-600">{record.date}</span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap font-semibold text-slate-600">
                          {formatTime(record.checkInTime)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap font-semibold text-slate-600">
                          {formatTime(record.checkOutTime)}
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
