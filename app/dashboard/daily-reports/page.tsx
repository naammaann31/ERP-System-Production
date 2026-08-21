"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Megaphone, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

export default function DailyReportsPage() {
  const departments = [
    {
      id: "marketing",
      name: "Marketing",
      description: "Responsible for brand management, advertising, and market research.",
      employeeCount: 8,
      manager: "Asrar Patni",
      icon: Megaphone,
      color: "bg-orange-50 text-orange-600 ring-orange-100",
      href: "/dashboard/daily-reports/marketing"
    },
    {
      id: "sales",
      name: "Sales",
      description: "Focuses on client acquisition, revenue generation, and partnerships.",
      employeeCount: 4,
      manager: "Pending Assignment",
      icon: TrendingUp,
      color: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      href: "/dashboard/daily-reports/sales"
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Daily Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage daily reports across different departments.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept, i) => (
          <motion.div
            key={dept.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Link href={dept.href}>
              <Card className="h-full border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-slate-300 group cursor-pointer bg-white relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 ${dept.color.split(' ')[0]} rounded-full blur-3xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                <div className="p-6 relative z-10 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl border ${dept.color.replace('ring-', 'border-')} shadow-sm bg-white`}>
                      <dept.icon className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">{dept.employeeCount} Members</span>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-2">
                    {dept.name}
                  </h3>
                  <p className="text-sm text-slate-500 flex-1 leading-relaxed">
                    {dept.description}
                  </p>

                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0 shadow-sm">
                        {dept.manager.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Department Head</span>
                        <span className="text-sm font-semibold text-slate-700">{dept.manager}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
