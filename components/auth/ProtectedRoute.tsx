"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

const checkUnauthorized = (pathname: string, role: string = "Employee", designation: string = ""): boolean => {
    const isAdmin = role === "Admin";
    const isAdminOrHR = isAdmin || role === "HR" || role === "OPS_HR";
    const isTeamLead = designation === "Team-Lead";

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

    const unauthorized = !loading && !!profile && checkUnauthorized(pathname, profile.role, profile.designation);

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

    return <>{children}</>;
}
