"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { logoutUser } from "@/lib/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, User, Menu, ChevronLeft, Bell, X } from "lucide-react";
import { useSidebar } from "@/components/providers/SidebarProvider";
import {
    Notification,
    listenToUserNotifications,
    markAsRead,
    markAllAsRead,
} from "@/lib/notifications";
import { motion, AnimatePresence } from "framer-motion";

const formatRelativeTime = (ts: any) => {
    if (!ts || !ts.toDate) return "";
    const diff = Date.now() - ts.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
};

export default function Navbar() {
    const { profile } = useAuth();
    const { isOpen, toggleSidebar } = useSidebar();
    const router = useRouter();

    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        if (!profile?.uid) return;
        const unsubscribe = listenToUserNotifications(profile.uid, (notifs) => {
            setNotifications(notifs);
        });
        return () => unsubscribe();
    }, [profile]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const executeLogout = async () => {
        await logoutUser();
        router.push("/login");
    };

    const handleLogoutClick = () => {
        setShowProfile(false);
        setShowLogoutConfirm(true);
    };

    const handleMarkAllRead = async () => {
        if (!profile?.uid) return;
        await markAllAsRead(profile.uid);
    };

    const handleNotifClick = async (notif: Notification) => {
        if (!notif.read && notif.id) {
            await markAsRead(notif.id);
        }
        setShowNotifications(false);
        if (notif.type === "announcement") {
            router.push("/dashboard/announcements");
        } else if (notif.type === "leave") {
            router.push("/dashboard/leave");
        } else if (notif.type === "payroll") {
            router.push("/dashboard/payroll");
        }
    };

    const initials = profile?.fullName
        ? profile.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';

    return (
        <>
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 h-16 flex items-center justify-between px-6 sticky top-0 z-50">
                <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors md:flex"
                    aria-label="Toggle Sidebar"
                >
                    {isOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <div className="md:hidden flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center mt-0.5">
                        <Image
                            src="/updated_logo.png"
                            alt="Vectra Logo"
                            width={48}
                            height={48}
                            priority
                            className="object-contain scale-[2.5]"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 ml-auto relative">
                {/* Notification Bell */}
                <div className="relative">
                    <button
                        onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
                        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1 shadow-sm">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                            <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <button onClick={handleMarkAllRead} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800">
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications</div>
                                    ) : (
                                        notifications.slice(0, 15).map((notif) => (
                                            <button
                                                key={notif.id}
                                                onClick={() => handleNotifClick(notif)}
                                                className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!notif.read ? "bg-blue-50/50" : ""}`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    {!notif.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-xs ${!notif.read ? "font-bold text-slate-800" : "font-medium text-slate-600"}`}>{notif.message}</p>
                                                        <p className="text-[10px] text-slate-400 mt-1">{formatRelativeTime(notif.createdAt)}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="hidden sm:flex flex-col items-end mr-1">
                    <span className="text-sm font-bold text-slate-800 tracking-tight">
                        {profile?.fullName || "Loading..."}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider mt-0.5 shadow-sm">
                        {profile?.role || "Employee"}
                    </span>
                </div>

                <div className="relative">
                    <button
                        onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
                        className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white border border-slate-100 hover:ring-blue-100 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        {initials}
                    </button>

                    {showProfile && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                            <div className="absolute top-14 right-0 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 text-left z-50 animate-in fade-in slide-in-from-top-2 cursor-default">
                                <div className="flex flex-col items-center justify-center border-b border-slate-100 pb-4 mb-4">
                                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-2xl shadow-md mb-3">
                                        {initials}
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-lg tracking-tight">{profile?.fullName}</h3>
                                    <p className="text-xs font-semibold text-slate-500 mb-2">{profile?.email}</p>
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {profile?.role || "Employee"}
                                    </span>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Department</p>
                                        <p className="text-sm font-semibold text-slate-700">{profile?.department || "General"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Employee ID</p>
                                        <p className="text-sm font-semibold text-slate-700">{profile?.employeeId || "N/A"}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleLogoutClick}
                                    className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 py-2.5 rounded-xl transition-colors"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Logout
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                <button
                    onClick={handleLogoutClick}
                    className="hidden sm:flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-600 bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] transition-all"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                </button>
            </div>
        </header>

        <AnimatePresence>
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
                        >
                            <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Sign Out</h2>
                                    <p className="text-xs font-semibold text-slate-500 mt-1">Confirm your request to leave</p>
                                </div>
                                <button onClick={() => setShowLogoutConfirm(false)} className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">
                                <p className="text-sm font-semibold text-slate-600 mb-6">
                                    Are you sure you want to sign out of your account? You will need to log back in to access your dashboard.
                                </p>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowLogoutConfirm(false)} className="rounded-xl border border-slate-200 font-bold hover:bg-slate-50 px-6 py-2.5 text-slate-600 text-sm transition-colors">
                                        Cancel
                                    </button>
                                    <button type="button" onClick={executeLogout} className="rounded-xl bg-slate-900 hover:bg-black font-bold px-6 py-2.5 shadow-md shadow-slate-900/20 active:scale-95 transition-all text-white text-sm">
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
