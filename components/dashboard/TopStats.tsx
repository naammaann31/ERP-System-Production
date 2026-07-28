"use client";

import { motion } from "framer-motion";
import { CalendarCheck, Clock, Palmtree, ClipboardList, Users, Wallet } from "lucide-react";

const stats = [
  { title: "Attendance", value: "-", subtitle: "No data", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
  { title: "Working Hours", value: "-", subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },
  { title: "Leave Balance", value: "-", subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },
  { title: "Salary Status", value: "Pending", subtitle: "July 2026", icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500" },
];

export default function TopStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group cursor-pointer relative overflow-hidden"
        >
          {/* Subtle gradient background on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          {/* Bottom accent line that expands on hover */}
          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 ${stat.accent} group-hover:w-full transition-all duration-500 ease-out`} />

          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className={`p-2 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ease-out`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 group-hover:border-slate-300 group-hover:text-slate-700 transition-colors duration-300 shadow-sm">{stat.subtitle}</span>
          </div>
          <div className="relative z-10">
            <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors duration-300">{stat.value}</p>
            <p className="text-[11px] md:text-xs font-semibold text-slate-500 mt-0.5">{stat.title}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
