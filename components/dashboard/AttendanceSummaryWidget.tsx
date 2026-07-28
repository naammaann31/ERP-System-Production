"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function AttendanceSummaryWidget() {
  // Mock data for current month (July)
  const stats = {
    present: 18,
    absent: 1,
    leave: 2,
    late: 3,
    halfDay: 0,
    wfh: 4,
    totalWorkingDays: 22,
  };

  const attendancePercentage = Math.round((stats.present / stats.totalWorkingDays) * 100);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Monthly Summary</CardTitle>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold bg-slate-50 border-slate-200">
            July 2026
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Background Circle */}
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Progress Circle */}
              <path
                className="text-green-500 transition-all duration-1000 ease-out"
                strokeWidth="3.5"
                strokeDasharray={`${attendancePercentage}, 100`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-slate-800 tabular-nums leading-none">{attendancePercentage}%</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Health Score</p>
            <p className="text-sm font-medium text-slate-700 leading-snug">
              {attendancePercentage >= 90 ? "Excellent attendance record this month. Keep it up!" : "Your attendance is below the 90% threshold."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> Present</span>
              <span className="text-slate-900 font-bold">{stats.present}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> WFH</span>
              <span className="text-slate-900 font-bold">{stats.wfh}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500" /> Late</span>
              <span className="text-slate-900 font-bold">{stats.late}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> Absent</span>
              <span className="text-slate-900 font-bold">{stats.absent}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
