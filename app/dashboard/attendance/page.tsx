"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import HRAttendanceDashboard from "@/components/dashboard/attendance/HRAttendanceDashboard";
import EmployeeAttendanceDashboard from "@/components/dashboard/attendance/EmployeeAttendanceDashboard";

export default function AttendancePage() {
  const { profile } = useAuth();

  const role = profile?.role?.toUpperCase();
  const isAdminOrHR = role === "ADMIN" || role === "HR" || role === "OPS_HR";

  if (isAdminOrHR) {
    return <HRAttendanceDashboard />;
  }

  return <EmployeeAttendanceDashboard />;
}
