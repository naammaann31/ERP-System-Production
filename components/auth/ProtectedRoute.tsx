"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { hasMarketingTeamLeadOverride } from "@/lib/marketingTeamLeadAccess";
import { toast } from "sonner";

const checkUnauthorized = (pathname: string, role: string = "Employee", designation: string = "", uid?: string): boolean => {
    const isAdmin = role === "Admin";
    const isAdminOrHR = isAdmin || role === "HR" || role === "OPS_HR";
    const isTeamLead = designation === "Team-Lead" || hasMarketingTeamLeadOverride(uid);

    // The full company-wide directory stays Admin/HR-only.
    if (pathname === "/dashboard/employees" && !isAdminOrHR) {
        return true;
    }
    // Individual employee profiles: Team-Leads can also view these (their
    // own team, reached via "My Team"), even though they aren't Admin/HR.
    if (pathname.startsWith("/dashboard/employees/") && !isAdminOrHR && !isTeamLead) {
        return true;
    }
    if (pathname.startsWith("/dashboard/departments") && !isAdmin) {
        return true;
    }
    return false;
};

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, profile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const hasToastedRef = useRef(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => {
            const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const minPhysicalDimension = Math.min(window.screen.width, window.screen.height);
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobileUA = /mobi|android|iphone/.test(userAgent);

            if (window.innerWidth <= 768 || (hasTouch && minPhysicalDimension < 600) || (hasTouch && isMobileUA)) {
                setIsMobile(true);
            } else {
                setIsMobile(false);
            }
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const unauthorized = !loading && !!profile && checkUnauthorized(pathname, profile.role, profile.designation, profile.uid);

    useEffect(() => {
        if (!loading && (!user || !profile)) {
            router.push("/login");
            return;
        }
        if (unauthorized) {
            if (!hasToastedRef.current) {
                hasToastedRef.current = true;
                toast.error("Unauthorized Access", {
                    description: "You do not have permission to view this page."
                });
            }
            router.replace("/dashboard");
        } else {
            hasToastedRef.current = false;
        }
    }, [user, profile, loading, router, unauthorized, pathname]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-4">
                    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-500 font-medium">Authenticating...</p>
                </div>
            </div>
        );
    }

    if (!user || !profile || unauthorized) {
        return null;
    }

    if (mounted && isMobile && profile.email?.toLowerCase().trim() !== "mehul.parmer@vectraforeignservices.com") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4">
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-red-500/50 shadow-2xl text-center w-full max-w-sm">
                    <div className="bg-red-500/20 text-red-300 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center border border-red-500/30">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3 tracking-wide">Desktop Only</h1>
                    <p className="text-white/80 text-base leading-relaxed">
                        For security reasons, this system is restricted to desktop access for your account. 
                        Please switch to a computer.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
