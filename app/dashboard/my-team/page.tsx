"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Users, ArrowRight, Calendar, ChevronDown, ChevronUp, Edit2, Trash2, X, Download, UserCircle, Search, Filter } from "lucide-react";
import { toast } from "sonner";

export default function MyTeamPage() {
  const { profile } = useAuth();
  const router = useRouter();
  
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"directory" | "reports">("directory");
  const [reports, setReports] = useState<any[]>([]);
  
  // Filters
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState<string>("All");
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Edit State
  const [editingReport, setEditingReport] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  
  // Generate Master Report State
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchReports = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("marketing_daily_reports")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (!error && data) {
        setReports(data);
    }
  };

  useEffect(() => {
    if (!profile) return;

    if (profile.designation !== "Team-Lead" && profile.jobRole !== "Team-Lead") {
      router.push("/dashboard");
      return;
    }

    const supabase = createClient();

    const fetchTeam = async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const emps: any[] = [];
      (data || []).forEach((row: any) => {
        const leadDept = profile.department?.toLowerCase();
        const leadRole = profile.role?.toLowerCase();
        const memberDept = row.department?.toLowerCase();
        const memberRole = row.role?.toLowerCase();

        const isSameDept = (leadDept && memberDept && leadDept === memberDept) ||
                           (leadRole && memberRole && leadRole === memberRole);

        if (isSameDept) {
            emps.push({
            uid: row.id,
            id: row.employee_id || "N/A",
            name: row.full_name || "Unnamed",
            jobRole: row.job_role || "N/A",
            designation: row.designation || "Employee",
            createdAt: row.created_at ? new Date(row.created_at).getTime() : 0
            });
        }
      });
      emps.sort((a, b) => b.createdAt - a.createdAt);
      setTeamMembers(emps);
      setLoading(false);
    };

    fetchTeam();
    fetchReports();

    const channel = supabase
      .channel(`profiles_my_team_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchTeam)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, router]);

  const handleDeleteReport = async (id: number) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("marketing_daily_reports").delete().eq("id", id);
      if (error) throw error;
      toast.success("Report deleted successfully");
      fetchReports();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete report");
    }
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEditLoading(true);
      const supabase = createClient();
      const { error } = await supabase
        .from("marketing_daily_reports")
        .update({
          applications: editingReport.applications,
          rtr_submissions: editingReport.rtr_submissions,
          screenings: editingReport.screenings,
          interviews: editingReport.interviews,
          no_of_candidates: editingReport.no_of_candidates
        })
        .eq("id", editingReport.id);
        
      if (error) throw error;
      toast.success("Report updated successfully");
      setEditingReport(null);
      fetchReports();
    } catch (error: any) {
      toast.error(error.message || "Failed to update report");
    } finally {
      setEditLoading(false);
    }
  };

  // Filter Reports logic
  let filteredReports = reports.filter(r => teamMembers.some(tm => tm.uid === r.user_id));
  if (filterDate) {
      filteredReports = filteredReports.filter(r => r.report_date === filterDate);
  }
  if (filterEmployee !== "All") {
      filteredReports = filteredReports.filter(r => r.user_id === filterEmployee);
  }

  // Process reports to aggregate candidate breakdown by case-insensitive name
  const processedReports = filteredReports.map(report => {
    if (!report.candidate_breakdown || !Array.isArray(report.candidate_breakdown)) return report;
    
    const aggregated: Record<string, any> = {};
    
    report.candidate_breakdown.forEach((cb: any) => {
      if (!cb.name) return;
      const normalizedName = cb.name.trim().toLowerCase();
      if (aggregated[normalizedName]) {
        aggregated[normalizedName].applications += (parseInt(cb.applications) || 0);
      } else {
        // Capitalize each word for consistent display
        const displayName = cb.name.trim().split(' ').map((word: string) => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '').join(' ');
        aggregated[normalizedName] = {
          name: displayName,
          applications: parseInt(cb.applications) || 0
        };
      }
    });

    const newBreakdown = Object.values(aggregated);
    
    return {
      ...report,
      candidate_breakdown: newBreakdown,
      no_of_candidates: newBreakdown.length
    };
  });

  const handleGenerateMasterReport = async () => {
    if (processedReports.length === 0) {
      toast.error("No reports available to generate");
      return;
    }
    
    setIsGenerating(true);
    try {
      const supabase = createClient();
      const today = filterDate || new Date().toISOString().split("T")[0];
      
      const { error } = await supabase.from("team_lead_reports").insert({
        team_lead_id: profile?.uid,
        team_lead_name: profile?.fullName || "Unknown",
        report_date: today,
        report_data: processedReports
      });
      
      if (error) throw error;
      toast.success("Master Report generated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
          <svg className="animate-spin h-6 w-6 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-medium">Loading team directory...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-[1400px] mx-auto space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-700" />
            My Team Directory
          </h1>
          <p className="text-slate-500 text-sm mt-1">All members currently assigned to your department.</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center space-x-2 bg-white p-1.5 rounded-xl w-fit border border-slate-200 shadow-sm">
        <button
          onClick={() => setView("directory")}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            view === "directory" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          Team Members
        </button>
        <button
          onClick={() => setView("reports")}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            view === "reports" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          Daily Reports
        </button>
      </div>

      {view === "directory" ? (
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-5">Employee Details</th>
                  <th className="px-6 py-5">Job Role</th>
                  <th className="px-6 py-5">Designation</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No team members found in your department.
                    </td>
                  </tr>
                ) : (
                  teamMembers.map((member, index) => (
                    <motion.tr 
                      key={member.uid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="bg-white hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0 shadow-sm">
                             {member.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors text-base" onClick={() => router.push(`/dashboard/employees/${member.uid}?from=my-team`)}>
                              {member.name}
                            </p>
                            <p className="text-slate-500 font-mono text-[10px] mt-0.5 bg-slate-100 px-2 py-0.5 rounded w-fit">{member.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                        {member.jobRole}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                          {member.designation}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                          <button 
                            className="p-2.5 text-slate-400 hover:text-white hover:bg-blue-600 rounded-full transition-all flex items-center justify-center ml-auto shadow-sm"
                            title="View Profile"
                            onClick={() => router.push(`/dashboard/employees/${member.uid}?from=my-team`)}
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
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
                  className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm w-full sm:w-auto"
                />
                {filterDate && (
                  <button 
                    onClick={() => setFilterDate('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
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
                  {teamMembers.map(tm => (
                    <option key={tm.uid} value={tm.uid}>{tm.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>
            
            <button
              onClick={handleGenerateMasterReport}
              disabled={isGenerating || processedReports.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              {isGenerating ? "Saving Master Report..." : "Generate Report"}
            </button>
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
                  <th className="px-6 py-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedReports.map((report) => (
                  <React.Fragment key={report.id}>
                    <tr 
                      className={`hover:bg-blue-50/30 transition-colors group ${expandedRowId === report.id ? 'bg-blue-50/30' : 'bg-white'}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === report.id ? null : report.id)}>
                        <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                          {report.report_date}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-bold cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === report.id ? null : report.id)}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${expandedRowId === report.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'} transition-colors`}>
                            {report.user_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="group-hover:text-blue-700 transition-colors">{report.user_name}</span>
                          {report.candidate_breakdown && report.candidate_breakdown.length > 0 && (
                            <div className="ml-2">
                              {expandedRowId === report.id ? (
                                <ChevronUp className="w-4 h-4 text-blue-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-600 font-semibold cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === report.id ? null : report.id)}>{report.no_of_candidates}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === report.id ? null : report.id)}>
                        <span className="inline-flex px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-black text-xs border border-emerald-100">
                          {report.applications}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-600 font-semibold cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === report.id ? null : report.id)}>{report.rtr_submissions}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-600 font-semibold cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === report.id ? null : report.id)}>{report.screenings}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-600 font-semibold cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === report.id ? null : report.id)}>{report.interviews}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingReport({ ...report }); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Edit Report"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* EXPANDED ROW: CANDIDATE BREAKDOWN */}
                    <AnimatePresence>
                      {expandedRowId === report.id && report.candidate_breakdown && report.candidate_breakdown.length > 0 && (
                        <motion.tr 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-50/50 border-t-0"
                        >
                          <td colSpan={8} className="px-8 py-6">
                            <div className="bg-gradient-to-b from-white to-slate-50/80 p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500" />
                                Candidate Breakdown
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {report.candidate_breakdown.map((cb: any, i: number) => (
                                  <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    key={i} 
                                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group/card cursor-default"
                                  >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 group-hover/card:bg-blue-600 group-hover/card:text-white transition-colors">
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
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
                
                {processedReports.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <Search className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-base font-medium text-slate-600">No daily reports found</p>
                        <p className="text-sm mt-1">Try adjusting your date or employee filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Report Modal */}
      <AnimatePresence>
        {editingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Edit Daily Report</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{editingReport.user_name} • {editingReport.report_date}</p>
                </div>
                <button
                  onClick={() => setEditingReport(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateReport} className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Candidates</label>
                    <input
                      type="number"
                      value={editingReport.no_of_candidates}
                      onChange={e => setEditingReport({...editingReport, no_of_candidates: parseInt(e.target.value) || 0})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Applications</label>
                    <input
                      type="number"
                      value={editingReport.applications}
                      onChange={e => setEditingReport({...editingReport, applications: parseInt(e.target.value) || 0})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">RTR Submissions</label>
                    <input
                      type="number"
                      value={editingReport.rtr_submissions}
                      onChange={e => setEditingReport({...editingReport, rtr_submissions: parseInt(e.target.value) || 0})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Screenings</label>
                    <input
                      type="number"
                      value={editingReport.screenings}
                      onChange={e => setEditingReport({...editingReport, screenings: parseInt(e.target.value) || 0})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interviews</label>
                    <input
                      type="number"
                      value={editingReport.interviews}
                      onChange={e => setEditingReport({...editingReport, interviews: parseInt(e.target.value) || 0})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingReport(null)}
                    className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm shadow-blue-500/20 disabled:opacity-50"
                  >
                    {editLoading ? "Saving Changes..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

