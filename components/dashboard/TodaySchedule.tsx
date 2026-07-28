"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Video, CheckSquare, ClockAlert, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const schedule: any[] = [];

export default function TodaySchedule() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Today's Schedule</CardTitle>
          <span className="text-xs font-semibold text-slate-500">{schedule.length} events</span>
        </div>
      </CardHeader>
      <CardContent>
        {schedule.length > 0 ? (
          <div className="relative border-l-2 border-slate-100 ml-3 space-y-6 pb-2">
            {schedule.map((item) => (
              <div key={item.id} className="relative pl-6">
                <div className={`absolute -left-[11px] top-0.5 p-1 rounded-full bg-white border-2 border-slate-100`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${item.bg.replace('100', '500')}`} />
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{item.title}</span>
                    {item.urgent && (
                      <Badge variant="destructive" className="px-1.5 py-0 text-[9px] h-4 leading-4 uppercase tracking-wider">
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <div className="bg-slate-50 p-3 rounded-full mb-3 border border-slate-100">
              <CheckSquare className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No Events Today</p>
            <p className="text-xs mt-1">Your schedule is clear for the day.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
