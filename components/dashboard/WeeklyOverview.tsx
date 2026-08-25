"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, CalendarDays } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getUserAttendanceForMonth } from "@/lib/attendance";

type Period = "This Week" | "Last Week" | "This Month";

export default function WeeklyOverview() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>("This Week");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!profile?.uid) return;
      const today = new Date();
      
      const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthRecords = await getUserAttendanceForMonth(profile.uid, currentYearMonth);
      
      const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastYearMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
      const lastMonthRecords = await getUserAttendanceForMonth(profile.uid, lastYearMonth);
      
      const combined = [...currentMonthRecords, ...lastMonthRecords];
      const uniqueRecords = Array.from(new Map(combined.map(r => [r.date, r])).values());
      
      setRecords(uniqueRecords);
    }
    fetchData();
  }, [profile?.uid]);

  const chartData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; 
    
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - dayOfWeek + 1);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const getWeekData = (startMonday: Date) => {
      const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const bars = [];
      let presentCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let pendingCount = 0;

      for (let i = 0; i < 7; i++) {
        const d = new Date(startMonday);
        d.setDate(startMonday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const rec = records.find(r => r.date === dateStr);
        let value = 0;
        let status = "Pending";
        
        if (!rec) {
            if (d > today) {
                status = "Future";
            } else if (d.getDay() === 0 || d.getDay() === 6) {
                status = "Week Off";
            } else {
                status = "Pending";
                pendingCount++;
            }
        } else {
            if (rec.status === "Present" || rec.status === "Checked In") {
                const workingSecs = rec.workingSeconds || 0;
                let dayPerc = Math.min(100, Math.round((workingSecs / 32400) * 100));
                
                if (workingSecs === 0) {
                    dayPerc = rec.isHalfDay ? 50 : 100;
                }
                value = dayPerc;

                if (rec.isHalfDay) {
                    status = "Half Day";
                    halfDayCount++;
                } else {
                    status = "Present";
                    presentCount++;
                }
            } else if (rec.status === "Absent") {
                absentCount++;
                value = 15; // Give it a tiny bit of height so it's visible as red
                status = "Absent";
            } else if (rec.status === "Week Off") {
                value = 100;
                status = "Week Off";
            } else if (rec.status === "Pending") {
                status = "Pending";
                pendingCount++;
            }
        }
        
        // Ensure weekends without records default to Week Off
        if (d.getDay() === 0 || d.getDay() === 6) {
             if (status === "Future" || status === "Pending") {
                 status = "Week Off";
                 value = 100;
             }
        }

        bars.push({ label: weekDays[i], value, status, date: dateStr });
      }
      return { bars, stats: { presentCount, halfDayCount, absentCount, pendingCount } };
    };

    const getMonthData = () => {
      const bars = [];
      let presentCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let pendingCount = 0;
      
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      let currentWeekIndex = 1;
      let weekPresent = 0;
      let weekWorkingDays = 0;
      let statusesInWeek: string[] = [];
      
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        const rec = records.find(r => r.date === dateStr);
        
        if (rec) {
            if (rec.status === "Present" || rec.status === "Checked In") {
                const workingSecs = rec.workingSeconds || 0;
                let dayPerc = Math.min(100, Math.round((workingSecs / 32400) * 100));
                
                if (workingSecs === 0) {
                    dayPerc = rec.isHalfDay ? 50 : 100;
                }
                weekPresent += (dayPerc / 100);

                if (rec.isHalfDay) {
                    halfDayCount++;
                    statusesInWeek.push("Half Day");
                } else {
                    presentCount++;
                    statusesInWeek.push("Present");
                }
                weekWorkingDays++;
            } else if (rec.status === "Absent") {
                absentCount++;
                weekWorkingDays++;
                statusesInWeek.push("Absent");
            } else if (rec.status === "Week Off") {
                 statusesInWeek.push("Week Off");
            } else if (rec.status === "Pending") {
                pendingCount++;
                statusesInWeek.push("Pending");
                if (dateObj <= today && dateObj.getDay() !== 0 && dateObj.getDay() !== 6) {
                    weekWorkingDays++;
                }
            }
        } else {
            if (dateObj > today) {
                // future
            } else {
                if (dateObj.getDay() !== 0 && dateObj.getDay() !== 6) {
                    pendingCount++;
                    weekWorkingDays++;
                    statusesInWeek.push("Pending");
                }
            }
        }

        if (dateObj.getDay() === 0 || d === daysInMonth) {
            const weekValue = weekWorkingDays > 0 ? Math.round((weekPresent / weekWorkingDays) * 100) : 0;
            
            // For month view, status is mixed, we'll label it as Average
            bars.push({ label: `Wk ${currentWeekIndex}`, value: weekValue, status: "Weekly Average" });
            
            currentWeekIndex++;
            weekPresent = 0;
            weekWorkingDays = 0;
            statusesInWeek = [];
        }
      }
      
      return { bars, stats: { presentCount, halfDayCount, absentCount, pendingCount } };
    };

    if (period === "This Week") {
      return getWeekData(thisMonday);
    } else if (period === "Last Week") {
      return getWeekData(lastMonday);
    } else {
      return getMonthData();
    }
  }, [period, records]);

  // Color mapper based on status
  const getBarColor = (status: string, value: number) => {
    switch (status) {
      case "Present": return "bg-emerald-400";
      case "Half Day": return "bg-blue-400";
      case "Absent": return "bg-red-400";
      case "Week Off": return "bg-slate-50 border-2 border-dashed border-slate-200";
      case "Pending": return "bg-slate-300";
      case "Weekly Average": return value >= 90 ? "bg-emerald-400" : value >= 50 ? "bg-blue-400" : value > 0 ? "bg-red-400" : "bg-slate-300";
      default: return "bg-slate-100";
    }
  };

  const getStatusText = (status: string, value: number) => {
    if (status === "Weekly Average") return `${value}%`;
    return status;
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full relative z-10">
      <div className="flex justify-between items-center mb-8 relative z-50">
        <h3 className="font-bold text-slate-800 text-lg">Attendance Overview</h3>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[12px] text-slate-700 font-bold flex items-center gap-1.5 border border-slate-200 bg-white px-4 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow group"
          >
            <CalendarDays className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
            {period}
            <ChevronDown className={`h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-all duration-300 ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[60] animate-in fade-in zoom-in-95 duration-200">
              {(["This Week", "Last Week", "This Month"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 transition-colors ${period === p ? "text-blue-600 bg-blue-50/50" : "text-slate-600"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 mt-auto relative pt-4">
        {/* Y Axis lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 pb-1">
          {[100, 75, 50, 25, 0].map((step, i) => (
            <div key={i} className="flex items-center gap-4 w-full opacity-40">
              <span className="text-[11px] font-medium text-slate-400 w-8 text-right">{step}%</span>
              <div className="flex-1 border-b border-dashed border-slate-200"></div>
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="relative z-10 flex w-full justify-between items-end h-[140px] pl-10 pr-1 pb-1">
          {chartData.bars.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-1 group w-full relative cursor-pointer">
              
              {/* Tooltip */}
              <div className="absolute -top-8 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none transform -translate-y-2 group-hover:translate-y-0 duration-200 z-50">
                {getStatusText(day.status, day.value)}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
              </div>

              <div className="w-5 md:w-6 bg-slate-50 rounded-t-lg rounded-b-sm h-[120px] relative overflow-hidden ring-1 ring-slate-100 group-hover:ring-slate-200 transition-all">
                <div 
                  className={`absolute bottom-0 w-full rounded-t-lg rounded-b-sm transition-all duration-1000 ${getBarColor(day.status, day.value)}`}
                  style={{ height: `${day.status === 'Week Off' ? 100 : day.value}%` }}
                >
                   
                </div>
              </div>
              <span className={`text-[11px] font-bold mt-1.5 transition-colors ${day.status === 'Future' ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-800'}`}>{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8 pt-5 border-t border-slate-100">
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50/80 border border-slate-100/50">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div> Present
          </div>
          <span className="text-sm font-black text-slate-800">{chartData.stats.presentCount} <span className="text-xs font-semibold text-slate-500">{chartData.stats.presentCount === 1 ? 'Day' : 'Days'}</span></span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50/80 border border-slate-100/50">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]"></div> Half Day
          </div>
          <span className="text-sm font-black text-slate-800">{chartData.stats.halfDayCount} <span className="text-xs font-semibold text-slate-500">{chartData.stats.halfDayCount === 1 ? 'Day' : 'Days'}</span></span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50/80 border border-slate-100/50">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"></div> Absent
          </div>
          <span className="text-sm font-black text-slate-800">{chartData.stats.absentCount} <span className="text-xs font-semibold text-slate-500">{chartData.stats.absentCount === 1 ? 'Day' : 'Days'}</span></span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50/80 border border-slate-100/50">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1">
            <div className="w-2 h-2 rounded-full bg-slate-300"></div> Pending
          </div>
          <span className="text-sm font-black text-slate-800">{chartData.stats.pendingCount} <span className="text-xs font-semibold text-slate-500">{chartData.stats.pendingCount === 1 ? 'Day' : 'Days'}</span></span>
        </div>
      </div>
    </div>
  );
}
