"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { 
    LayoutDashboard, 
    Users, 
    Building2, 
    CalendarCheck, 
    CalendarOff, 
    CircleDollarSign, 
    UserPlus, 
    FileText, 
    BarChart3, 
    Settings 
} from "lucide-react";

const NAV_LINKS = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["Admin", "HR", "Employee"] },
    { name: "Employees", href: "/dashboard/employees", icon: Users, roles: ["Admin", "HR"] },
    { name: "Departments", href: "/dashboard/departments", icon: Building2, roles: ["Admin"] },
    { name: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck, roles: ["Admin", "HR", "Employee"] },
    { name: "Leave", href: "/dashboard/leave", icon: CalendarOff, roles: ["Admin", "HR", "Employee"] },
    { name: "Payroll", href: "/dashboard/payroll", icon: CircleDollarSign, roles: ["Admin", "HR", "Employee"] },
    { name: "Recruitment", href: "/dashboard/recruitment", icon: UserPlus, roles: ["Admin", "HR"] },
    { name: "Documents", href: "/dashboard/documents", icon: FileText, roles: ["Admin", "HR", "Employee"] },
    { name: "Reports", href: "/dashboard/reports", icon: BarChart3, roles: ["Admin", "HR"] },
    { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["Admin", "HR", "Employee"] },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { profile } = useAuth();
    
    // Default to 'Employee' if profile isn't loaded yet to avoid flickering restricted links
    const rawRole = profile?.role || "Employee";
    const userRole = rawRole === "Admin" ? "Admin" 
                   : (rawRole === "HR" || rawRole === "OPS_HR") ? "HR" 
                   : "Employee";

    return (
        <aside className="w-64 bg-white border-r border-slate-200/60 flex flex-col h-screen sticky top-0 hidden md:flex">
            <div className="h-16 flex items-center justify-center border-b border-slate-200/60 shrink-0">
                <div className="w-8 h-8 flex items-center justify-center mt-1">
                    <Image 
                        src="/updated_logo.png" 
                        alt="Vectra Logo" 
                        width={64} 
                        height={64} 
                        className="object-contain scale-[2.5]" 
                    />
                </div>
            </div>
            
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                {NAV_LINKS.filter(link => link.roles.includes(userRole)).map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;
                    
                    return (
                        <Link 
                            key={link.name} 
                            href={link.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                isActive 
                                ? "bg-slate-900 text-white shadow-md" 
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-400"}`} />
                            {link.name}
                        </Link>
                    );
                })}
            </nav>
            
            <div className="p-4 border-t border-slate-200/60 shrink-0">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System Status</p>
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-sm font-medium text-slate-700">Operational</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
