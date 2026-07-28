"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { logoutUser } from "@/lib/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, User, Menu, ChevronLeft } from "lucide-react";
import { useSidebar } from "@/components/providers/SidebarProvider";

export default function Navbar() {
    const { profile } = useAuth();
    const { isOpen, toggleSidebar } = useSidebar();
    const router = useRouter();

    const [showProfile, setShowProfile] = useState(false);

    const handleLogout = async () => {
        await logoutUser();
        router.push("/login");
    };

    const initials = profile?.fullName
        ? profile.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';

    return (
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
                            className="object-contain scale-[2.5]" 
                        />
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-4 ml-auto relative">
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
                        onClick={() => setShowProfile(!showProfile)}
                        className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white border border-slate-100 hover:ring-blue-100 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        {initials}
                    </button>
                    
                    {showProfile && (
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
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 py-2.5 rounded-xl transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>
                
                <button 
                    onClick={handleLogout}
                    className="hidden sm:flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-600 bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] transition-all"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                </button>
            </div>
        </header>
    );
}
