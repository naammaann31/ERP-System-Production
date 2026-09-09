"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock, CalendarOff, FileSpreadsheet, Users, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

export default function QuickActions() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "Admin";

  const actions = [
    {
      title: "Attendance Log",
      desc: "Track your daily working hours",
      icon: Clock,
      href: "/dashboard/attendance",
      bg: "bg-blue-50",
      color: "text-blue-600",
      border: "group-hover:border-blue-200 shadow-blue-500/5"
    },
    {
      title: "Apply Leave",
      desc: "Request time off or sick leave",
      icon: CalendarOff,
      href: "/dashboard/leave",
      bg: "bg-rose-50",
      color: "text-rose-600",
      border: "group-hover:border-rose-200 shadow-rose-500/5"
    },
    {
      title: "Daily Reports",
      desc: "Submit your End of Day report",
      icon: FileSpreadsheet,
      href: "/dashboard/daily-reports",
      bg: "bg-emerald-50",
      color: "text-emerald-600",
      border: "group-hover:border-emerald-200 shadow-emerald-500/5"
    },
    {
      title: isAdmin ? "All Employees" : "My Team",
      desc: isAdmin ? "Manage company directory" : "View your teammates",
      icon: Users,
      href: isAdmin ? "/dashboard/employees" : "/dashboard/my-team",
      bg: "bg-purple-50",
      color: "text-purple-600",
      border: "group-hover:border-purple-200 shadow-purple-500/5"
    }
  ];

  return (
    <Card className="h-full relative overflow-hidden border-slate-100 shadow-sm transition-all">
      {/* Premium Background Flare */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-transparent rounded-full blur-3xl opacity-70 pointer-events-none" />
      
      <CardHeader className="pb-3 border-b border-slate-50 relative z-10 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Sparkles className="h-4 w-4 text-blue-500" /> 
              Quick Actions
            </CardTitle>
            <p className="text-xs text-slate-500 font-medium mt-1">Shortcuts to your most used features</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-5 relative z-10 bg-white/50 backdrop-blur-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.map((action, i) => (
            <Link 
              href={action.href} 
              key={i}
              className={`group flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/80 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${action.border}`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${action.bg} group-hover:scale-105 transition-transform duration-300 shadow-sm`}>
                <action.icon className={`h-4 w-4 ${action.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-[13px] mb-0.5 group-hover:text-slate-900 transition-colors truncate">{action.title}</h4>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {action.desc}
                </p>
              </div>
              <div className="shrink-0 p-1 rounded-full bg-slate-50 group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 duration-300">
                <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-700" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
