"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, XCircle, Clock, Search, Download, Filter } from "lucide-react";
import { getAllTodayAttendance, AttendanceRecord, getLocalDateString, formatAttendanceTime } from "@/lib/attendance";
import { useAuth } from "@/components/providers/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import * as xlsx from "xlsx";

const formatTime = formatAttendanceTime;

const getStatusBadge = (status: string, isHalfDay?: boolean, isLate?: boolean) => {
  let mainBadge;
  switch (status) {
    case "Present": mainBadge = <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-200">Present</Badge>; break;
    case "Checked In": mainBadge = <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-200">Clocked In</Badge>; break;
    case "Leave": mainBadge = <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-orange-200">Leave</Badge>; break;
    case "WFH": mainBadge = <Badge variant="info" className="bg-blue-50 text-blue-600 border-blue-200">WFH</Badge>; break;
    case "Absent": mainBadge = <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200">Absent</Badge>; break;
    case "Late": mainBadge = <Badge variant="warning" className="bg-amber-50 text-amber-600 border-amber-200">Late</Badge>; break;
    case "Week Off": mainBadge = <Badge variant="outline" className="bg-slate-50 text-slate-500">Week Off</Badge>; break;
    default: mainBadge = <Badge>{status}</Badge>;
  }

  if (isHalfDay || isLate) {
    return (
      <div className="flex items-center gap-2">
        {mainBadge}
        {isHalfDay && <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200">Half Day</Badge>}
      </div>
    );
  }
  return mainBadge;
};

const hrStats = [
  { title: "Total Present Today", value: "0", trend: "+12%", trendUp: true, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", accent: "bg-emerald-500" },
  { title: "Total Absent", value: "0", trend: "-2%", trendUp: true, icon: XCircle, color: "text-red-600", bg: "bg-red-100", accent: "bg-red-500" },
  { title: "On Leave", value: "0", trend: "0%", trendUp: true, icon: Clock, color: "text-blue-600", bg: "bg-blue-100", accent: "bg-blue-500" },
  { title: "Late Arrivals", value: "0", trend: "0", trendUp: false, icon: Clock, color: "text-orange-600", bg: "bg-orange-100", accent: "bg-orange-500" },
];

export default function HRAttendanceDashboard() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  // Always query by the current business day. The app stores timestamps in IST
  // wall-clock, but JS Date() is local. getLocalDateString wraps istParts() to
  // give the true Indian date, shifted back to yesterday if it's before 6:00 AM
  // YESTERDAY — so an early-morning shift showed an empty table because it
  // was querying the wrong day.
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);
  const [filterLate, setFilterLate] = useState(false);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      const data = await getAllTodayAttendance();
      setRecords(data);
      setLoading(false);
    };
    fetchRecords();
  }, [selectedDate]);

  const filteredEmployees = records.filter(emp => {
    const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.status.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterLate) {
      return matchesSearch && emp.isLate;
    }
    return matchesSearch;
  });

  const exportToCSV = () => {
    const ws = xlsx.utils.json_to_sheet(filteredEmployees.map(emp => ({
      "Employee Name": emp.fullName,
      "Status": emp.status,
      "Check In Time": formatTime(emp.checkInTime),
      "Check Out Time": formatTime(emp.checkOutTime),
    })));
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Attendance");
    xlsx.writeFile(wb, `Attendance_Report_${selectedDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Company Attendance</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Overview of today's attendance metrics</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full md:w-auto bg-white flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-800 font-medium ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2 bg-white hover:bg-slate-50 transition-colors shadow-sm text-slate-700 font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {hrStats.map((stat, i) => {
          let val = stat.value;
          if (stat.title === "Total Present Today") {
            val = records.length.toString();
          } else if (stat.title === "Late Arrivals") {
            val = records.filter(r => r.isLate).length.toString();
          }

          const isFilterActive = filterLate && stat.title === "Late Arrivals";

          return (
            <motion.div
              key={stat.title}
              onClick={() => stat.title === "Late Arrivals" ? setFilterLate(!filterLate) : null}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
              className={`bg-white rounded-2xl p-4 border shadow-sm flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group ${stat.title === "Late Arrivals" ? "cursor-pointer" : "cursor-default"} relative overflow-hidden ${isFilterActive ? "border-orange-500 ring-2 ring-orange-500/20" : "border-slate-100"}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 ${stat.accent} group-hover:w-full transition-all duration-500 ease-out`} />
              
              <div className="flex justify-between items-start mb-2 relative z-10">
                <div className={`p-2 rounded-xl ${stat.bg} ${stat.color} shadow-inner`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.trendUp ? (
                  <span className="text-emerald-600 bg-emerald-50 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-100/50">
                    {stat.trend}
                  </span>
                ) : (
                  <span className="text-red-600 bg-red-50 text-[10px] font-bold px-2 py-1 rounded-full border border-red-100/50">
                    {stat.trend}
                  </span>
                )}
              </div>
              <div className="relative z-10">
                <h3 className="text-slate-500 text-xs font-semibold mb-0.5">{stat.title}</h3>
                <p className="text-2xl font-black text-slate-800 tracking-tight">{val}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden rounded-2xl">
        <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-6 rounded-full bg-[#4f46e5]"></span>
            Employee Details
          </h2>
          <div className="flex w-full sm:w-auto items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                placeholder="Search employees..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-800 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9 pr-4 h-9 bg-white border-slate-200 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4f46e5] mb-4"></div>
              <p className="font-medium">Loading records...</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-slate-500 uppercase bg-white border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="px-5 py-4 font-bold">Employee</th>
                  <th className="px-5 py-4 font-bold">Check In</th>
                  <th className="px-5 py-4 font-bold">Check Out</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="bg-slate-50/50 rounded-2xl p-8 max-w-sm mx-auto border border-slate-100/50">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100">
                          <Search className="w-5 h-5 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium text-sm">No employees found matching your search criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((record) => (
                    <tr key={record.id} className="bg-white hover:bg-slate-50/80 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-900">{record.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{record.role || 'Employee'}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600 font-medium">
                        {formatTime(record.checkInTime)}
                      </td>
                      <td className="px-5 py-3 text-slate-600 font-medium">
                        {formatTime(record.checkOutTime)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {getStatusBadge(record.status, record.isHalfDay, record.isLate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}


