"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Megaphone, CheckCircle2, FileText, AlertCircle } from "lucide-react";

const notifications: any[] = [];

export default function RecentNotifications() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Notifications</CardTitle>
          <button className="text-xs font-bold text-blue-600 hover:text-blue-700">View All</button>
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <div key={notif.id} className="flex gap-3 items-start group cursor-pointer">
                <div className={`p-2 rounded-lg shrink-0 ${notif.bg} group-hover:scale-105 transition-transform`}>
                  <notif.icon className={`h-4 w-4 ${notif.color}`} />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{notif.title}</p>
                    <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{notif.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{notif.desc}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <div className="bg-slate-50 p-3 rounded-full mb-3 border border-slate-100">
              <Megaphone className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">All Caught Up</p>
            <p className="text-xs mt-1">You have no new notifications.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
