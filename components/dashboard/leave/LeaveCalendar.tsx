"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LeaveRequest } from "@/lib/leave";

export default function LeaveCalendar({ leaves, isHR }: { leaves: LeaveRequest[]; isHR: boolean }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  // Build map: day -> leaves on that day
  const dayLeaveMap = useMemo(() => {
    const map: Record<number, { name: string; status: string; type: string }[]> = {};
    leaves.forEach((l) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push({ name: isHR ? l.fullName : l.leaveType, status: l.status, type: l.leaveType });
        }
      }
    });
    return map;
  }, [leaves, year, month, isHR]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 px-5 py-4 bg-white flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold text-slate-800">Leave Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-bold text-slate-700 min-w-[140px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2">{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayLeaves = dayLeaveMap[day] || [];
            const hasApproved = dayLeaves.some((l) => l.status === "Approved");
            const hasPending = dayLeaves.some((l) => l.status === "Pending");

            return (
              <div
                key={day}
                className={`h-20 rounded-lg border p-1.5 transition-colors ${isToday(day) ? "border-slate-900 bg-slate-50" :
                  hasApproved ? "border-emerald-200 bg-emerald-50/50" :
                    hasPending ? "border-amber-200 bg-amber-50/50" :
                      "border-slate-100 hover:bg-slate-50"
                  }`}
              >
                <div className={`text-xs font-bold mb-1 ${isToday(day) ? "text-slate-900" : "text-slate-600"}`}>{day}</div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayLeaves.slice(0, 2).map((l, idx) => (
                    <div
                      key={idx}
                      className={`text-[8px] font-semibold px-1 py-0.5 rounded truncate ${l.status === "Approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : l.status === "Pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-600"
                        }`}
                    >
                      {l.name}
                    </div>
                  ))}
                  {dayLeaves.length > 2 && (
                    <div className="text-[8px] font-bold text-slate-400">+{dayLeaves.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Approved
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" /> Rejected
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
