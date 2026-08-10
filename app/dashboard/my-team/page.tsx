"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/AuthProvider";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, MoreVertical, ArrowRight } from "lucide-react";


export default function MyTeamPage() {
  const { profile } = useAuth();
  const router = useRouter();
  
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    // Team Leads can only see this page
    if (profile.designation !== "Team-Lead" && profile.jobRole !== "Team-Lead") {
      router.push("/dashboard");
      return;
    }

    const q = collection(db, "users");
    // We fetch all users and filter client-side for flexibility, or we can use a query if department/role is strictly defined.
    // Assuming team members share the same role (e.g., MARKETING) or department.
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter logic: match the Team Lead's role or department
        const leadDept = profile.department?.toLowerCase();
        const leadRole = profile.role?.toLowerCase();
        const memberDept = data.department?.toLowerCase();
        const memberRole = data.role?.toLowerCase();
        
        const isSameDept = (leadDept && memberDept && leadDept === memberDept) || 
                           (leadRole && memberRole && leadRole === memberRole);
                           
        if (isSameDept) {
            emps.push({
            uid: doc.id,
            id: data.employeeId || "N/A",
            name: data.fullName || "Unnamed",
            jobRole: data.jobRole || "N/A",
            designation: data.designation || "Employee",
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
            });
        }
      });
      emps.sort((a, b) => b.createdAt - a.createdAt);
      setTeamMembers(emps);
      setLoading(false);
    });
    
    return () => unsubscribe();
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
                          <p className="font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => router.push(`/dashboard/employees/${member.uid}?from=my-team`)}>
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
    </motion.div>
  );
}
