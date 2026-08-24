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
      
      // Fetch current month
      const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthRecords = await getUserAttendanceForMonth(profile.uid, currentYearMonth);
      
      // Fetch last month (to cover Last Week if it spans months)
      const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastYearMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
      const lastMonthRecords = await getUserAttendanceForMonth(profile.uid, lastYearMonth);
      
      // Combine and remove duplicates
      const combined = [...currentMonthRecords, ...lastMonthRecords];
      const uniqueRecords = Array.from(new Map(combined.map(r => [r.date, r])).values());
      
      setRecords(uniqueRecords);
    }
    fetchData();
  }, [profile?.uid]);

  const chartData = useMemo(() => {
    const today = new Date();
    // In JS getDay() is 0=Sun, 1=Mon
    const dayOfWeek = today.getDay() || 7; 
    
    // Monday of This Week
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - dayOfWeek + 1);
    
    // Monday of Last Week
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    // Helper to get records for a specific 7-day range starting from a Monday
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
        
        if (!rec) {
            // Future or unrecorded
            if (d > today) pendingCount++;
            else if (d.getDay() !== 0 && d.getDay() !== 6) pendingCount++;
        } else {
            if (rec.status === "Present" || rec.status === "Checked In") {
                if (rec.isHalfDay) {
                    value = 50;
                    halfDayCount++;
                } else {
                    value = 100;
                    presentCount++;
                }
            } else if (rec.status === "Absent") {
                absentCount++;
                value = 0;
            } else if (rec.status === "Week Off") {
                value = 0;
            } else if (rec.status === "Pending") {
                pendingCount++;
            }
        }
        
        bars.push({ label: weekDays[i], value });
      }
      return { bars, stats: { presentCount, halfDayCount, absentCount, pendingCount } };
    };

    // Helper for This Month
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
      
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        const rec = records.find(r => r.date === dateStr);
        
        if (rec) {
            if (rec.status === "Present" || rec.status === "Checked In") {
                if (rec.isHalfDay) {
                    weekPresent += 0.5;
                    halfDayCount++;
                } else {
                    weekPresent += 1;
                    presentCount++;
                }
                weekWorkingDays++;
            } else if (rec.status === "Absent") {
                absentCount++;
                weekWorkingDays++;
            } else if (rec.status === "Week Off") {
                // Do not increment working days
            } else if (rec.status === "Pending") {
                pendingCount++;
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
                }
            }
        }

        // End of week (Sunday) or end of month
        if (dateObj.getDay() === 0 || d === daysInMonth) {
            const weekValue = weekWorkingDays > 0 ? Math.round((weekPresent / weekWorkingDays) * 100) : 0;
            bars.push({ label: `Wk ${currentWeekIndex}`, value: weekValue });
            
            // reset for next week
            currentWeekIndex++;
            weekPresent = 0;
            weekWorkingDays = 0;
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

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-6 relative">
        <h3 className="font-bold text-slate-800">Attendance Overview</h3>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[11px] text-slate-600 font-bold flex items-center gap-1.5 border border-slate-200 bg-white px-3.5 py-1.5 rounded-full hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all duration-300 shadow-sm hover:shadow active:scale-95 group"
          >
            <CalendarDays className="h-3.5 w-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
            {period}
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-all duration-300 ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-100 rounded-xl shadow-lg shadow-slate-200/50 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
              {(["This Week", "Last Week", "This Month"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${period === p ? "text-blue-600 bg-blue-50/50" : "text-slate-600"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 mt-auto relative">
        {/* Y Axis lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0">
          {[100, 75, 50, 25, 0].map((step, i) => (
            <div key={i} className="flex items-center gap-3 w-full opacity-40">
              <span className="text-[10px] text-slate-400 w-8 text-right">{step}%</span>
              <div className="flex-1 border-b border-dashed border-slate-200"></div>
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="relative z-10 flex w-full justify-between items-end h-[100px] pl-8 pr-1 pb-1">
          {chartData.bars.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-1 group w-full">
              <div className="text-[9px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity mb-0.5">
                {day.value}%
              </div>
              <div className="w-3 bg-slate-100 rounded-full h-[60px] relative overflow-hidden">
                <div 
                  className={`absolute bottom-0 w-full rounded-full transition-all duration-1000 ${day.value > 90 ? 'bg-emerald-400' : (day.value > 0 ? 'bg-blue-400' : 'bg-slate-300')}`}
                  style={{ height: `${day.value}%` }}
                />
              </div>
              <span className="text-[9px] font-semibold text-slate-500 whitespace-nowrap mt-1">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100">
        <div className="flex flex-col items-center justify-center text-center p-1.5 rounded-lg border border-slate-100 bg-white">
          <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Present
          </div>
          <span className="text-[10px] font-bold text-slate-800">{chartData.stats.presentCount} {chartData.stats.presentCount === 1 ? 'Day' : 'Days'}</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-1.5 rounded-lg border border-slate-100 bg-white">
          <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Half Day
          </div>
          <span className="text-[10px] font-bold text-slate-800">{chartData.stats.halfDayCount} {chartData.stats.halfDayCount === 1 ? 'Day' : 'Days'}</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-1.5 rounded-lg border border-slate-100 bg-white">
          <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Absent
          </div>
          <span className="text-[10px] font-bold text-slate-800">{chartData.stats.absentCount} {chartData.stats.absentCount === 1 ? 'Day' : 'Days'}</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-1.5 rounded-lg border border-slate-100 bg-white">
          <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Pending
          </div>
          <span className="text-[10px] font-bold text-slate-800">{chartData.stats.pendingCount} {chartData.stats.pendingCount === 1 ? 'Day' : 'Days'}</span>
        </div>
      </div>
    </div>
  );
}
