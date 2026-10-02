"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getTeamLeadReports, getMarketingDailyReports, getInterviewScreeningBreakdown } from "@/app/actions/marketing";
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, Search, Filter, Megaphone, CheckCircle2, CalendarClock, PhoneCall, UserCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { hasMarketingTeamLeadOverride } from "@/lib/marketingTeamLeadAccess";

export default function MarketingDailyReportsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  
  const [masterReports, setMasterReports] = useState<any[]>([]);
  // The live submissions a master report was built from. A master report only
  // stores a JSON snapshot, so these are what decide whether it still has
  // anything to show and what the numbers actually are.
  const [liveReports, setLiveReports] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState<string>("All");
  const [expandedRowId, setExpandedRowId] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);

  // Interview/Screening breakdown (candidate + stage) for the expanded row —
  // fetched live, on demand, cached per row key.
  const [breakdownCache, setBreakdownCache] = useState<
    Record<string, { interviews: { candidate: string; client: string; stage: string; remarks: string }[]; screenings: { candidate: string; client: string; stage: string; remarks: string }[] }>
  >({});
  const [breakdownLoading, setBreakdownLoading] = useState<string | number | null>(null);

  useEffect(() => {
    // Basic protection: Only HR and Admin should ideally access, but maybe Team Lead too
    if (profile && profile.role !== "HR" && profile.role !== "Admin" && profile.designation !== "Team-Lead" && profile.jobRole !== "Team-Lead" && !hasMarketingTeamLeadOverride(profile.uid)) {
      router.push("/dashboard");
      return;
    }

    const fetchMasterReports = async () => {
      try {
        const [masters, live] = await Promise.all([
          getTeamLeadReports(),
          getMarketingDailyReports(),
        ]);
        if (masters) setMasterReports(masters);
        if (live) setLiveReports(live);
      } catch (err) {
        console.error("Failed to fetch reports", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMasterReports();
  }, [profile, router]);

  const isMarketingReport = (rd: any) => {
    if (!rd) return false;
    if (rd.department === 'Marketing') return true;
    if (rd.department === 'Sales') return false;
    if (rd.no_of_calls !== undefined || rd.answered_calls !== undefined || rd.churned_calls !== undefined || rd.leads !== undefined || rd.closed !== undefined) {
      return false;
    }
    return rd.applications !== undefined || rd.no_of_candidates !== undefined || rd.rtr_submissions !== undefined || rd.screenings !== undefined || rd.interviews !== undefined;
  };

  const marketingMasterReports = masterReports.filter(m => 
    m.report_data && Array.isArray(m.report_data) && m.report_data.some((rd: any) => isMarketingReport(rd))
  );

  // If no date is selected, show the latest date available from the marketing master reports
  const activeDate = filterDate || (marketingMasterReports.length > 0 ? marketingMasterReports[0].report_date : "");
  
  let displayReports: any[] = [];
  if (activeDate) {
    // A Team Lead can regenerate the master report for a date, which inserts a
    // second team_lead_reports row carrying the *same* submissions. Flattening
    // every master for the date would therefore list each submission twice, so
    // keep one entry per submission id.
    //
    // Copies are merged rather than replaced: the newest master wins for every
    // field it actually carries, while a field it is missing keeps the value an
    // earlier master recorded. Older masters were written before the metric
    // fields were populated correctly, so replacing outright would blank out
    // counts that are still perfectly good.
    const matched = marketingMasterReports
      .filter(r => r.report_date === activeDate)
      .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

    const liveById = new Map(liveReports.map((r: any) => [String(r.id), r]));

    const seen = new Map<string, number>();
    matched.forEach(m => {
      if (!m.report_data || !Array.isArray(m.report_data)) return;
      m.report_data.filter((rd: any) => isMarketingReport(rd)).forEach((rd: any) => {
        const hasId = rd.id !== undefined && rd.id !== null;
        const live = hasId ? liveById.get(String(rd.id)) : undefined;

        // A master report is only a snapshot of submissions. Once the
        // submission behind an entry has been deleted there is nothing left to
        // report on, so the row is dropped rather than shown with figures that
        // no longer exist in the database.
        if (hasId && !live) return;

        // The live submission is the source of truth for the counts; the
        // snapshot only supplies the aggregated candidate breakdown.
        const entry = live
          ? {
              ...rd,
              no_of_candidates: live.no_of_candidates ?? rd.no_of_candidates ?? 0,
              applications: live.applications ?? rd.applications ?? 0,
              rtr_submissions: live.rtr_submissions ?? rd.rtr_submissions ?? 0,
              screenings: live.screenings ?? rd.screenings ?? 0,
              interviews: live.interviews ?? rd.interviews ?? 0,
              candidate_breakdown: rd.candidate_breakdown ?? live.candidate_breakdown,
            }
          : {
              ...rd,
              no_of_candidates: rd.no_of_candidates ?? 0,
              applications: rd.applications ?? 0,
              rtr_submissions: rd.rtr_submissions ?? 0,
              screenings: rd.screenings ?? 0,
              interviews: rd.interviews ?? 0,
            };

        const existing = hasId ? seen.get(String(rd.id)) : undefined;
        if (existing !== undefined) {
          displayReports[existing] = { ...displayReports[existing], ...entry };
          return;
        }
        if (hasId) seen.set(String(rd.id), displayReports.length);
        displayReports.push(entry);
      });
    });
  }

  // Get unique employees for the filter dropdown
  const uniqueEmployees = Array.from(new Set(displayReports.map(r => r.user_id))).map(id => {
    const rep = displayReports.find(r => r.user_id === id);
    return { uid: id, name: rep?.user_name || "Unknown" };
  });

  if (filterEmployee !== "All") {
    displayReports = displayReports.filter(r => r.user_id === filterEmployee);
  }

  // Must mirror the rowKey formula used in the table body below exactly,
  // since that's what expandedRowId is actually set to.
  useEffect(() => {
    if (expandedRowId == null || breakdownCache[String(expandedRowId)]) return;
    const idx = displayReports.findIndex((r, i) => (r.id ?? `${r.user_id ?? "row"}-${i}`) === expandedRowId);
    if (idx === -1) return;
    const report = displayReports[idx];
    if (!report?.user_id || !report?.report_date) return;

    setBreakdownLoading(expandedRowId);
    getInterviewScreeningBreakdown(report.user_id, report.report_date)
      .then((result) => setBreakdownCache((prev) => ({ ...prev, [String(expandedRowId)]: result })))
      .catch((err) => console.error("Failed to load interview/screening breakdown:", err))
      .finally(() => setBreakdownLoading(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedRowId]);

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
            <Megaphone className="w-6 h-6 text-orange-500" />
            Marketing Daily Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">Master reports submitted by the Marketing Team Lead.</p>
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
                value={activeDate}
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
                {uniqueEmployees.map(tm => (
                  <option key={tm.uid} value={tm.uid}>{tm.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Master Report Verified
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-6 py-5">Date</th>
                <th className="px-6 py-5">Name</th>
                <th className="px-6 py-5 text-center">Candidates</th>
                <th className="px-6 py-5 text-center">Applications</th>
                <th className="px-6 py-5 text-center">RTR</th>
                <th className="px-6 py-5 text-center">Screenings</th>
                <th className="px-6 py-5 text-center">Interviews</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 font-medium">Loading reports...</td>
                </tr>
              ) : displayReports.map((report, idx) => {
                // One identity per row, used for the React key and for the
                // expand/collapse state, so two rows can never share either.
                const rowKey = report.id ?? `${report.user_id ?? "row"}-${idx}`;
                return (
                <React.Fragment key={rowKey}>
                  <tr 
                    className={`hover:bg-blue-50/30 transition-colors group ${expandedRowId === rowKey ? 'bg-blue-50/30' : 'bg-white'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === rowKey ? null : rowKey)}>
                      <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                        {report.report_date}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-bold cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === rowKey ? null : rowKey)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${expandedRowId === rowKey ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'} transition-colors`}>
                          {report.user_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="group-hover:text-blue-700 transition-colors">{report.user_name}</span>
                        {((report.candidate_breakdown && report.candidate_breakdown.length > 0) || report.interviews > 0 || report.screenings > 0 || report.rtr_names) && (
                          <div className="ml-2">
                            {expandedRowId === rowKey ? (
                              <ChevronUp className="w-4 h-4 text-blue-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-600 font-semibold cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === rowKey ? null : rowKey)}>{report.no_of_candidates}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === rowKey ? null : rowKey)}>
                      <span className="inline-flex px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-black text-xs border border-emerald-100">
                        {report.applications}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === rowKey ? null : rowKey)}>
                      <span className="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-black text-xs border border-blue-100">
                        {report.rtr_submissions}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === rowKey ? null : rowKey)}>
                      <span className="inline-flex px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-black text-xs border border-purple-100">
                        {report.screenings}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === rowKey ? null : rowKey)}>
                      <span className="inline-flex px-3 py-1 rounded-full bg-orange-50 text-orange-700 font-black text-xs border border-orange-100">
                        {report.interviews}
                      </span>
                    </td>
                  </tr>
                  
                  <AnimatePresence>
                    {expandedRowId === rowKey &&
                      ((report.candidate_breakdown && report.candidate_breakdown.length > 0) ||
                        report.interviews > 0 ||
                        report.screenings > 0 ||
                        report.rtr_names) && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-blue-50/10 border-b border-blue-50/50"
                      >
                        <td colSpan={7} className="px-0 py-0">
                          <div className="px-6 py-6 overflow-hidden space-y-4">
                            {report.rtr_names && (
                              <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <UserCircle className="w-3.5 h-3.5 text-indigo-500" />
                                  RTR Details
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {report.rtr_names.split(",").map((n: string) => n.trim()).filter(Boolean).map((name: string, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm text-sm font-bold text-slate-700"
                                    >
                                      <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0">
                                        {name.charAt(0).toUpperCase()}
                                      </span>
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {report.candidate_breakdown && report.candidate_breakdown.length > 0 && (
                              <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <Search className="w-3.5 h-3.5" />
                                  Candidate Breakdown
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                  {report.candidate_breakdown.map((cb: any, i: number) => (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                      key={i}
                                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group/card"
                                    >
                                      <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 font-black text-xs shrink-0 group-hover/card:from-blue-100 group-hover/card:to-indigo-100 transition-colors">
                                          {cb.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-slate-700 text-sm truncate" title={cb.name}>{cb.name}</span>
                                      </div>
                                      <div className="flex flex-col items-end shrink-0 ml-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 group-hover/card:bg-blue-50 group-hover/card:border-blue-100 transition-colors">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Apps</span>
                                        <span className="font-black text-blue-600 text-sm">{cb.applications}</span>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(report.interviews > 0 || report.screenings > 0) && (
                              breakdownLoading === rowKey ? (
                                <p className="text-xs text-slate-400 font-medium">Loading interview/screening details...</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  {report.interviews > 0 && (
                                    <div>
                                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                        <CalendarClock className="w-3.5 h-3.5 text-orange-500" />
                                        Interview Details
                                      </h4>
                                      <div className="space-y-1.5">
                                        {(breakdownCache[String(rowKey)]?.interviews || []).map((it, i) => (
                                          <div key={i} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <span className="font-bold text-slate-900 text-base capitalize">{it.candidate}</span>
                                            <span className="flex items-center gap-2">
                                              <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Stage</span>
                                              <span className="text-sm font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full capitalize">{it.stage || "-"}</span>
                                            </span>
                                            <span className="text-sm text-slate-700 font-semibold"><span className="text-slate-500 font-bold">Client</span> {it.client || "-"}</span>
                                            {it.remarks && (
                                              <span className="text-sm text-slate-700 font-semibold italic">
                                                <span className="text-slate-500 font-bold not-italic">Remarks</span> "{it.remarks}"
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {report.screenings > 0 && (
                                    <div>
                                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                        <PhoneCall className="w-3.5 h-3.5 text-purple-500" />
                                        Screening Details
                                      </h4>
                                      <div className="space-y-1.5">
                                        {(breakdownCache[String(rowKey)]?.screenings || []).map((sc, i) => (
                                          <div key={i} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <span className="font-bold text-slate-900 text-base capitalize">{sc.candidate}</span>
                                            <span className="flex items-center gap-2">
                                              <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Screening/AI</span>
                                              <span className="text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full capitalize">{sc.stage || "-"}</span>
                                            </span>
                                            <span className="text-sm text-slate-700 font-semibold"><span className="text-slate-500 font-bold">Client</span> {sc.client || "-"}</span>
                                            {sc.remarks && (
                                              <span className="text-sm text-slate-700 font-semibold italic">
                                                <span className="text-slate-500 font-bold not-italic">Remarks</span> "{sc.remarks}"
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
                );
              })}
              
              {!loading && displayReports.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-600">No master report found</p>
                      <p className="text-sm mt-1">The Team Lead hasn't generated a report for this date yet.</p>
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
