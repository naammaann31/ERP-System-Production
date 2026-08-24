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
      
      <CardContent className="p-4 sm:p-5 relative z-10 bg-white/50 backdrop-blur-sm h-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 h-full">
          {actions.map((action, i) => (
            <Link 
              href={action.href} 
              key={i}
              className={`group flex flex-col justify-between p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${action.border}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-lg ${action.bg} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                  </div>
                  <div className="p-1.5 rounded-full bg-slate-50 group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100 shadow-sm">
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
                <h4 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-slate-900 transition-colors">{action.title}</h4>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {action.desc}
              </p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
