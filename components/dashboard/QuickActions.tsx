"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  CalendarCheck, 
  Palmtree, 
  Receipt, 
  FileText, 
  CreditCard, 
  Ticket, 
  UserCircle, 
  Contact 
} from "lucide-react";
import { motion } from "framer-motion";

import Link from "next/link";

const actions = [
  { icon: CalendarCheck, label: "Attendance", color: "text-blue-600", bg: "bg-blue-50", href: "/dashboard/attendance" },
  { icon: Palmtree, label: "Apply Leave", color: "text-green-600", bg: "bg-green-50", href: "/dashboard/leave" },
  { icon: Receipt, label: "Payslips", color: "text-purple-600", bg: "bg-purple-50", href: "/dashboard/documents" },
  { icon: FileText, label: "Documents", color: "text-orange-600", bg: "bg-orange-50", href: "/dashboard/documents" },
  { icon: UserCircle, label: "My Profile", color: "text-indigo-600", bg: "bg-indigo-50", href: "/dashboard/settings" },
];

export default function QuickActions() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 md:grid-cols-5 lg:grid-cols-5 gap-3">
          {actions.map((action, i) => (
            <Link key={action.label} href={action.href}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-white cursor-pointer h-full"
              >
                <div className={`p-3 rounded-full ${action.bg}`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <span className="text-[10px] md:text-xs font-semibold text-slate-600 text-center leading-tight">
                  {action.label}
                </span>
              </motion.div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
