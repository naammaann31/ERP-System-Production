"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import SalesDataTable from "@/components/dashboard/sales/SalesDataTable";
import SalesMasterTable from "@/components/dashboard/sales/SalesMasterTable";

function isSalesTeamLeadOrManagerOrAdmin(profile: any): boolean {
  if (!profile) return false;
  if (["Admin", "HR", "OPS_HR"].includes(profile.role)) return true;
  if (
    profile.role === "SALES" &&
    (profile.designation === "Team-Lead" ||
      profile.designation === "Manager" ||
      profile.jobRole === "Team-Lead" ||
      profile.jobRole === "Manager")
  ) {
    return true;
  }
  return false;
}

export default function SalesPage() {
  const { profile, loading } = useAuth();
  const canSeeMaster = isSalesTeamLeadOrManagerOrAdmin(profile);
  const [tab, setTab] = useState<"data" | "master">("data");

  if (loading) return null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sales</h1>
        <p className="text-sm text-slate-500">Leads, assignments, and daily call reports.</p>
      </div>

      {canSeeMaster && (
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab("data")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === "data" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Sales Data
          </button>
          <button
            onClick={() => setTab("master")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === "master" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Master Data
          </button>
        </div>
      )}

      {tab === "data" || !canSeeMaster ? <SalesDataTable /> : <SalesMasterTable />}
    </div>
  );
}
