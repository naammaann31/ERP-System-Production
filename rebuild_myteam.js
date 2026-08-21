const fs = require('fs');
const file = 'app/dashboard/my-team/page.tsx';

const newContent = `"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Users, MoreVertical, ArrowRight, Calendar, ChevronDown, ChevronUp } from "lucide-react";

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

  useEffect(() => {
    if (!profile) return;

    // Team Leads can only see this page
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

    const fetchReports = async () => {
      const { data, error } = await supabase
        .from("marketing_daily_reports")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (!error && data) {
          setReports(data);
      }
    };
    fetchReports();

    const channel = supabase
      .channel(\`profiles_my_team_\${Math.random().toString(36).slice(2)}\`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchTeam)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, router]);

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

  // Filter Reports logic
  let filteredReports = reports.filter(r => teamMembers.some(tm => tm.uid === r.user_id));
  if (filterDate) {
      filteredReports = filteredReports.filter(r => r.report_date === filterDate);
  }
  if (filterEmployee !== "All") {
      filteredReports = filteredReports.filter(r => r.user_id === filterEmployee);
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
      <div className="flex items-center space-x-2 bg-white p-1 rounded-xl w-fit border border-slate-200">
        <button
          onClick={() => setView("directory")}
          className={\`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all \${
            view === "directory" ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-900"
          }\`}
        >
          Team Members
        </button>
        <button
          onClick={() => setView("reports")}
          className={\`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all \${
            view === "reports" ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-900"
          }\`}
        >
          Daily Reports
        </button>
      </div>

      {view === "directory" ? (
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Employee Details</th>
                  <th className="px-6 py-4">Job Role</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4 text-right">Actions</th>
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
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0 shadow-sm">
                             {member.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => router.push(\`/dashboard/employees/\${member.uid}?from=my-team\`)}>
                              {member.name}
                            </p>
                            <p className="text-slate-500 font-mono text-[10px] mt-0.5">{member.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">
                        {member.jobRole}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                          {member.designation}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                          <button 
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex items-center justify-center ml-auto"
                            title="View Profile"
                            onClick={() => router.push(\`/dashboard/employees/\${member.uid}?from=my-team\`)}
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
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
          <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-sm bg-white border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-blue-500 transition-colors"
              />
              <button 
                onClick={() => setFilterDate('')}
                className="text-xs text-blue-600 hover:underline ml-2"
              >
                Clear Date
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <select 
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="text-sm bg-white border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-blue-500 transition-colors min-w-[150px]"
              >
                <option value="All">All Team Members</option>
                {teamMembers.map(tm => (
                  <option key={tm.uid} value={tm.uid}>{tm.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-center">Candidates</th>
                  <th className="px-6 py-4 text-center">Applications</th>
                  <th className="px-6 py-4 text-center">RTR</th>
                  <th className="px-6 py-4 text-center">Screenings</th>
                  <th className="px-6 py-4 text-center">Interviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => (
                  <React.Fragment key={report.id}>
                    <tr 
                      className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedRowId === report.id ? 'bg-slate-50/80' : ''}`}
                      onClick={() => setExpandedRowId(expandedRowId === report.id ? null : report.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">{report.report_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-bold flex items-center gap-2">
                        {report.candidate_breakdown && report.candidate_breakdown.length > 0 ? (
                          expandedRowId === report.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : null}
                        {report.user_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.no_of_candidates}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700 font-bold">{report.applications}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.rtr_submissions}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.screenings}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.interviews}</td>
                    </tr>
                    {expandedRowId === report.id && report.candidate_breakdown && report.candidate_breakdown.length > 0 && (
                      <tr className="bg-slate-50/50 border-t-0">
                        <td colSpan={7} className="px-12 py-4">
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Candidate Breakdown</h4>
                            <ul className="space-y-2">
                              {report.candidate_breakdown.map((cb: any, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                  <span className="font-semibold">{cb.name}</span> - Number of applications: <span className="font-bold text-slate-900">{cb.applications}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No daily reports found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
`;

fs.writeFileSync(file, newContent);
console.log('Successfully rebuilt page.tsx with expandable rows and filters!');
