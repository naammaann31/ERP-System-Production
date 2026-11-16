"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Calendar, ChevronDown, Search, Filter, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

interface SalesDailyReportRow {
  id: string;
  user_id: string;
  user_name: string;
  report_date: string;
  window_start: string | null;
  window_end: string | null;
  total_calls: number;
  new_calls: number;
  churned_calls: number;
  follow_up_requested: number;
  interested: number;
  not_interested: number;
  meeting_scheduled: number;
  closed: number;
  dead_lead: number;
  linkedin_requests_sent: number;
}

export default function SalesDailyReportsPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<SalesDailyReportRow[]>([]);
  const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [filterEmployee, setFilterEmployee] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Same access rule as the Marketing sibling page: Admin/HR, or any
    // Team-Lead/Manager (RLS itself further restricts a Sales Team-Lead to
    // reading sales_daily_reports specifically via is_sales_team_lead_or_manager()).
    if (profile && profile.role !== "HR" && profile.role !== "Admin" && profile.designation !== "Team-Lead" && profile.jobRole !== "Team-Lead" && profile.designation !== "Manager") {
      router.push("/dashboard");
    }
  }, [profile, router]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase.from("sales_daily_reports").select("*").order("report_date", { ascending: false }).order("user_name", { ascending: true });
    if (filterDate) query = query.eq("report_date", filterDate);
    const { data, error } = await query;
    if (!error) setReports(data || []);
    setLoading(false);
  }, [filterDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const uniqueEmployees = Array.from(new Set(reports.map((r) => r.user_id))).map((id) => {
    const rep = reports.find((r) => r.user_id === id);
    return { uid: id, name: rep?.user_name || "Unknown" };
  });

  const displayReports = filterEmployee === "All" ? reports : reports.filter((r) => r.user_id === filterEmployee);

  const formatTime = (ts: string | null) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/daily-reports"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
            Sales Daily Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">EOD reports submitted by the Sales Team.</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white rounded-2xl">
        <div className="flex flex-col sm:flex-row gap-4 p-5 border-b border-slate-100 bg-slate-50/50 justify-between items-center">
          <div className="flex items-center gap-4 flex-wrap w-full sm:w-auto">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm w-full sm:w-auto cursor-pointer"
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm w-full sm:min-w-[180px] appearance-none cursor-pointer"
              >
                <option value="All">All Team Members</option>
                {uniqueEmployees.map((tm) => (
                  <option key={tm.uid} value={tm.uid}>{tm.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-200 font-bold text-sm">
            {displayReports.length} report{displayReports.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-5 py-5">Date</th>
                <th className="px-5 py-5">Name</th>
                <th className="px-5 py-5">Shift Window</th>
                <th className="px-5 py-5 text-center">Total Calls</th>
                <th className="px-5 py-5 text-center">New (Attempt 1)</th>
                <th className="px-5 py-5 text-center">Churned (2/3)</th>
                <th className="px-5 py-5 text-center">Follow-up</th>
                <th className="px-5 py-5 text-center">Interested</th>
                <th className="px-5 py-5 text-center">Not Interested</th>
                <th className="px-5 py-5 text-center">Meeting</th>
                <th className="px-5 py-5 text-center">Closed</th>
                <th className="px-5 py-5 text-center">Dead Lead</th>
                <th className="px-5 py-5 text-center">LinkedIn Reqs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-10 text-center text-slate-500 font-medium">Loading reports...</td>
                </tr>
              ) : displayReports.map((report) => (
                <tr key={report.id} className="hover:bg-blue-50/30 transition-colors bg-white">
                  <td className="px-5 py-4 whitespace-nowrap text-slate-600 font-medium">
                    <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                      {report.report_date}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-900 font-bold">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 bg-slate-100 text-slate-600">
                        {report.user_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                      <span>{report.user_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-500 text-xs font-medium">
                    {formatTime(report.window_start)} – {formatTime(report.window_end)}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-center text-slate-700 font-bold">{report.total_calls}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-black text-xs border border-blue-100">{report.new_calls}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-center text-slate-600 font-semibold">{report.churned_calls}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-center text-slate-600 font-semibold">{report.follow_up_requested}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-black text-xs border border-emerald-100">{report.interested}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-center text-slate-500 font-semibold">{report.not_interested}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-black text-xs border border-purple-100">{report.meeting_scheduled}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex px-3 py-1 rounded-full bg-orange-50 text-orange-700 font-black text-xs border border-orange-100">{report.closed}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-center text-slate-400 font-semibold">{report.dead_lead}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-50 text-sky-700 font-black text-xs border border-sky-100">
                      {report.linkedin_requests_sent}
                    </span>
                  </td>
                </tr>
              ))}

              {!loading && displayReports.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-600">No reports found</p>
                      <p className="text-sm mt-1">No one has generated an EOD report for this date yet.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
