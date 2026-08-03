"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import HRLeaveDashboard from "@/components/dashboard/leave/HRLeaveDashboard";
import EmployeeLeaveDashboard from "@/components/dashboard/leave/EmployeeLeaveDashboard";

export default function LeavePage() {
  const { profile } = useAuth();

  const role = profile?.role?.toUpperCase();
  const isAdminOrHR = role === "ADMIN" || role === "HR" || role === "OPS_HR";

  if (isAdminOrHR) {
    return <HRLeaveDashboard />;
  }

  return <EmployeeLeaveDashboard />;
}
