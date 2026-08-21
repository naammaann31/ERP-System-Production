"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import {
    LayoutDashboard,
    Users,
    Building2,
    CalendarCheck,
    CalendarOff,
    CircleDollarSign,
    FileText,
    BarChart3,
    Briefcase,
    Settings,
    Megaphone,
    UserSearch,
    ClipboardList,
} from "lucide-react";

const NAV_LINKS = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["Admin", "HR", "Employee"] },
    { name: "Operations", href: "/dashboard/operations", icon: Briefcase, roles: ["Admin", "HR", "Employee"], department: "Sales" },
    { name: "Employees", href: "/dashboard/employees", icon: Users, roles: ["Admin", "HR"] },
    { name: "My Team", href: "/dashboard/my-team", icon: Users, roles: [] as string[], isTeamLeadOnly: true },
    { name: "Departments", href: "/dashboard/departments", icon: Building2, roles: ["Admin"] },
    { name: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck, roles: ["Admin", "HR", "Employee"] },
    { name: "Leave", href: "/dashboard/leave", icon: CalendarOff, roles: ["Admin", "HR", "Employee"] },
    { name: "Daily Report", href: "/dashboard/daily-reports", icon: ClipboardList, roles: ["Admin", "HR"] },
    { name: "Payroll", href: "/dashboard/payroll", icon: CircleDollarSign, roles: ["Admin", "HR", "Employee"] },
    { name: "Announcements", href: "/dashboard/announcements", icon: Megaphone, roles: ["Admin", "HR", "Employee"] },
    { name: "Documents", href: "/dashboard/documents", icon: FileText, roles: ["Admin", "HR", "Employee"] },
    { name: "Data", href: "/dashboard/data", icon: BarChart3, roles: ["Admin", "HR", "Employee"], department: "Marketing" },
    { name: "Candidates", href: "/dashboard/candidates", icon: UserSearch,
    ClipboardList, roles: ["Admin", "HR", "Employee"], department: "Marketing" },
    { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["Admin", "HR", "Employee"] },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { profile } = useAuth();
    const { isOpen } = useSidebar();
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingLeavesCount, setPendingLeavesCount] = useState(0);

    useEffect(() => {
        if (!profile) return;

        let isInitial = true;
        let lastCount = 0;
        let unsubscribeAnnouncements: (() => void) | undefined;
        let unsubscribeNotifs: (() => void) | undefined;
        let isMounted = true;
        
        import("@/lib/announcements").then(({ listenToAnnouncements }) => {
            if (!isMounted) return;
            unsubscribeAnnouncements = listenToAnnouncements((records) => {
                if (isInitial) {
                    isInitial = false;
                    lastCount = records.length;
                } else {
                    if (records.length > lastCount) {
                        const newAnnouncement = records[0];
                        import("sonner").then(({ toast }) => {
                            toast.success("New Announcement", {
                                description: newAnnouncement?.title || "Check the announcements tab.",
                            });
                        });
                        lastCount = records.length;
                    }
                }
            });
        });

        if (profile.uid) {
            import("@/lib/notifications").then(({ listenToUserNotifications }) => {
                if (!isMounted) return;
                unsubscribeNotifs = listenToUserNotifications(profile.uid, (notifs) => {
                    const unreadAnnouncements = notifs.filter(n => n.type === "announcement" && !n.read);
                    setUnreadCount(unreadAnnouncements.length);
                });
            });
        }

        // Listen to pending leaves for Admin/HR
        const isAdminOrHR = userRole === "Admin" || userRole === "HR";
        let unsubscribeLeaves: (() => void) | undefined;
        if (isAdminOrHR) {
            import("@/lib/leave").then(({ listenToAllLeaves }) => {
                if (!isMounted) return;
                unsubscribeLeaves = listenToAllLeaves((leaves) => {
                    const pending = leaves.filter(l =>
                        l.status === "Pending" && l.userId !== profile.uid
                    ).length;
                    setPendingLeavesCount(pending);
                });
            });
        }

        return () => {
            isMounted = false;
            if (unsubscribeAnnouncements) unsubscribeAnnouncements();
            if (unsubscribeNotifs) unsubscribeNotifs();
            if (unsubscribeLeaves) unsubscribeLeaves();
        };
    }, [profile]);

    useEffect(() => {
        if (pathname === '/dashboard/announcements' && profile?.uid) {
            setUnreadCount(0);
            import("@/lib/notifications").then(({ markTypeAsRead }) => {
                markTypeAsRead(profile.uid, "announcement");
            });
        }
        if (pathname === '/dashboard/leave') {
            setPendingLeavesCount(0);
        }
    }, [pathname, profile]);

    // Default to 'Employee' if profile isn't loaded yet to avoid flickering restricted links
    const rawRole = profile?.role || "Employee";
    const userRole = rawRole === "Admin" ? "Admin"
        : (rawRole === "HR" || rawRole === "OPS_HR") ? "HR"
            : "Employee";

    return (
        <aside className={`bg-white border-slate-200/60 flex flex-col h-screen sticky top-0 hidden md:flex z-40 overflow-hidden ${isOpen ? "w-64 border-r opacity-100" : "w-0 border-r-0 opacity-0"
            }`}>
            <div className="w-64 flex flex-col h-full shrink-0">
                <div className="h-16 flex items-center justify-center border-b border-slate-200/60 shrink-0">
                    <div className="w-8 h-8 flex items-center justify-center mt-1">
                        <Image
                            src="/updated_logo.png"
                            alt="Vectra Logo"
                            width={64}
                            height={64}
                            priority
                            className="object-contain scale-[2.5]"
                        />
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                    {NAV_LINKS.filter(link => {
                        if (link.isTeamLeadOnly) {
                            return profile?.designation === "Team-Lead" || profile?.jobRole === "Team-Lead";
                        }
                        if (link.department) {
                            const userDept = profile?.department?.toLowerCase() || "";
                            const userRoleStr = profile?.role?.toLowerCase() || "";
                            const targetDept = link.department.toLowerCase();
                            if (userDept !== targetDept && !userRoleStr.includes(targetDept)) return false;
                        }
                        return link.roles.includes(userRole);
                    }).map((link) => {
                        const isActive = pathname === link.href;
                        const Icon = link.icon;

                        return (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? "bg-slate-900 text-white shadow-md"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                            >
                                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                                <span className="flex-1 truncate">{link.name}</span>
                                {link.name === "Announcements" && unreadCount > 0 && (
                                    <span className="shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">
                                        {unreadCount}
                                    </span>
                                )}
                                {link.name === "Leave" && pendingLeavesCount > 0 && (
                                    <span className="shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">
                                        {pendingLeavesCount}
                                    </span>
                                )}
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
            </div>
        </aside>
    );
}


