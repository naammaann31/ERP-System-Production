"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Calendar, ChevronDown, Search, Filter, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";

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

  // Edit/delete here mirrors the RLS already in place (migration 40/47):
  // sales_daily_reports_update/delete both already allow Team-Lead/Manager/
  // Admin/HR to correct or remove a report - this just surfaces that in the UI.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const updateReportField = async (id: string, field: string, value: number | string) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    const supabase = createClient();
    const { error } = await supabase.from("sales_daily_reports").update({ [field]: value }).eq("id", id);
    if (error) toast.error("Failed to save: " + error.message);
  };

  const toggleRowSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const allSelected = displayReports.length > 0 && displayReports.every((r) => prev.has(r.id));
      if (allSelected) return new Set();
      return new Set(displayReports.map((r) => r.id));
    });
  };

  const handleDeleteRow = async (id: string) => {
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("sales_daily_reports").delete().eq("id", id);
      if (error) throw error;
      setReports((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      toast.success("Report deleted");
    } catch (err: any) {
      toast.error("Failed to delete: " + (err?.message || "unknown error"));
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("sales_daily_reports").delete().in("id", ids);
      if (error) throw error;
      setReports((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      toast.success(`Deleted ${ids.length} report(s)`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error("Failed to delete: " + (err?.message || "unknown error"));
    } finally {
      setDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

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

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-900 text-white px-5 py-3">
            <span className="text-sm font-semibold">{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-4 py-5 w-10">
                  <input
                    type="checkbox"
                    checked={displayReports.length > 0 && displayReports.every((r) => selectedIds.has(r.id))}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                    title="Select all visible"
                  />
                </th>
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
                <th className="px-2 py-5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-6 py-10 text-center text-slate-500 font-medium">Loading reports...</td>
                </tr>
              ) : displayReports.map((report) => {
                type NumericField =
                  | "total_calls" | "new_calls" | "churned_calls" | "follow_up_requested"
                  | "interested" | "not_interested" | "meeting_scheduled" | "closed"
                  | "dead_lead" | "linkedin_requests_sent";
                const numberCell = (field: NumericField, badgeClass?: string) => (
                  <td className="px-5 py-4 whitespace-nowrap text-center">
                    <input
                      type="number"
                      defaultValue={report[field]}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v !== report[field]) updateReportField(report.id, field, v);
                        else e.target.value = String(report[field]);
                      }}
                      className={`w-16 text-center rounded-full text-xs font-black border focus:outline-none focus:ring-1 focus:ring-blue-300 py-1 ${badgeClass || "bg-slate-50 text-slate-700 border-slate-200"}`}
                    />
                  </td>
                );
                return (
                <tr key={report.id} className={`hover:bg-blue-50/30 transition-colors bg-white ${selectedIds.has(report.id) ? "bg-blue-50/40" : ""}`}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(report.id)}
                      onChange={() => toggleRowSelected(report.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-600 font-medium">
                    <input
                      type="date"
                      defaultValue={report.report_date}
                      onBlur={(e) => e.target.value !== report.report_date && updateReportField(report.id, "report_date", e.target.value)}
                      className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold border border-transparent hover:border-slate-200 focus:border-blue-300 focus:bg-white focus:outline-none"
                    />
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
                  {numberCell("total_calls")}
                  {numberCell("new_calls", "bg-blue-50 text-blue-700 border-blue-100")}
                  {numberCell("churned_calls")}
                  {numberCell("follow_up_requested")}
                  {numberCell("interested", "bg-emerald-50 text-emerald-700 border-emerald-100")}
                  {numberCell("not_interested")}
                  {numberCell("meeting_scheduled", "bg-purple-50 text-purple-700 border-purple-100")}
                  {numberCell("closed", "bg-orange-50 text-orange-700 border-orange-100")}
                  {numberCell("dead_lead")}
                  {numberCell("linkedin_requests_sent", "bg-sky-50 text-sky-700 border-sky-100")}
                  <td className="px-2 py-4">
                    <button
                      onClick={() => setConfirmDeleteId(report.id)}
                      title="Delete report"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
                );
              })}

              {!loading && displayReports.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-6 py-16">
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

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { if (confirmDeleteId) handleDeleteRow(confirmDeleteId); }}
        title="Delete this report?"
        description="This permanently removes this EOD report. This cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
      />
      <ConfirmModal
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} report(s)?`}
        description="This permanently removes all selected EOD reports. This cannot be undone."
        confirmText="Delete All"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
