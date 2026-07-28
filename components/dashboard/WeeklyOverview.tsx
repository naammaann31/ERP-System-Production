"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, CalendarDays } from "lucide-react";

const allData = {
  "This Week": [
    { label: "Mon", value: 0 },
    { label: "Tue", value: 0 },
    { label: "Wed", value: 0 },
    { label: "Thu", value: 0 },
    { label: "Fri", value: 0 },
    { label: "Sat", value: 0 },
    { label: "Sun", value: 0 },
  ],
  "Last Week": [
    { label: "Mon", value: 100 },
    { label: "Tue", value: 100 },
    { label: "Wed", value: 95 },
    { label: "Thu", value: 95 },
    { label: "Fri", value: 100 },
    { label: "Sat", value: 0 },
    { label: "Sun", value: 0 },
  ],
  "This Month": [
    { label: "Wk 1", value: 98 },
    { label: "Wk 2", value: 95 },
    { label: "Wk 3", value: 90 },
    { label: "Wk 4", value: 100 },
    { label: "Wk 5", value: 0 },
  ]
};

type Period = keyof typeof allData;

export default function WeeklyOverview() {
  const [period, setPeriod] = useState<Period>("This Week");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const days = allData[period];

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
              {(Object.keys(allData) as Period[]).map((p) => (
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
          {days.map((day, i) => (
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
          <span className="text-[10px] font-bold text-slate-800">4 Days</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-1.5 rounded-lg border border-slate-100 bg-white">
          <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Half Day
          </div>
          <span className="text-[10px] font-bold text-slate-800">1 Day</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-1.5 rounded-lg border border-slate-100 bg-white">
          <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Absent
          </div>
          <span className="text-[10px] font-bold text-slate-800">0 Day</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-1.5 rounded-lg border border-slate-100 bg-white">
          <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Pending
          </div>
          <span className="text-[10px] font-bold text-slate-800">2 Days</span>
        </div>
      </div>
    </div>
  );
}
