"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { 
  Building2, 
  Megaphone, 
  LineChart, 
  Users, 
  Monitor,
  ChevronLeft,
  MoreVertical
} from "lucide-react";

const DEPARTMENTS: Record<string, any> = {
  marketing: { 
    name: "Marketing", 
    description: "Responsible for brand management, advertising, and market research.",
    icon: Megaphone, 
    role: "MARKETING", 
    gradient: "from-blue-600 to-indigo-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-600",
    manager: "Asrar Patni" 
  },
  it: { 
    name: "Information Technology", 
    description: "Handles infrastructure, software development, and technical support.",
    icon: Monitor, 
    role: "IT", 
    gradient: "from-indigo-600 to-purple-600",
    lightBg: "bg-indigo-50",
    textColor: "text-indigo-600",
    manager: "Mohammed Hamzah Saiyed" 
  },
  sales: { 
    name: "Sales", 
    description: "Focuses on client acquisition, revenue generation, and partnerships.",
    icon: LineChart, 
    role: "SALES", 
    gradient: "from-emerald-500 to-teal-600",
    lightBg: "bg-emerald-50",
    textColor: "text-emerald-600",
    manager: "Piyush Barad" 
  },
  hr: { 
    name: "Human Resources", 
    description: "Manages recruitment, employee relations, and company culture.",
    icon: Users, 
    role: "OPS_HR", 
    gradient: "from-amber-500 to-orange-500",
    lightBg: "bg-amber-50",
    textColor: "text-amber-600",
    manager: "Damini Mallick" 
  }
};

export default function DepartmentPage() {
  const params = useParams();
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const id = params.id as string;
  const dept = DEPARTMENTS[id];

  useEffect(() => {
    if (!dept) return;

    const supabase = createClient();

    const fetchEmployees = async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", dept.role);
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const emps = (data || []).map((row: any) => ({
        uid: row.id,
        fullName: row.full_name,
        employeeId: row.employee_id,
        jobRole: row.job_role,
        designation: row.designation,
      }));
      setEmployees(emps);
      setLoading(false);
    };

    fetchEmployees();

    const channel = supabase
      .channel(`profiles_dept_${dept.role}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchEmployees)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dept]);

  if (!dept) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <Building2 className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Department Not Found</h2>
        <button onClick={() => router.push("/dashboard/departments")} className="mt-4 text-blue-600 hover:underline">
          Return to Departments
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-8">
      {/* Back Button */}
      <button 
        onClick={() => router.push("/dashboard/departments")}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Departments
      </button>

      {/* Employee List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.5 }}
      >
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Team Directory
                <span className="bg-slate-200 text-slate-700 text-xs py-0.5 px-2.5 rounded-full font-semibold">
                  {employees.length}
                </span>
              </h2>
              <p className="text-sm text-slate-500 mt-1">All members currently assigned to {dept.name}.</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee Details</th>
                  <th className="px-6 py-4 font-semibold">Job Role</th>
                  <th className="px-6 py-4 font-semibold">Designation</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <svg className="animate-spin h-6 w-6 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Loading team members...</span>
                      </div>
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No employees found in this department.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee, index) => (
                    <motion.tr 
                      key={employee.uid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="bg-white hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${dept.lightBg} ${dept.textColor}`}>
                            {(employee.fullName || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/employees/${employee.uid}`)}>
                              {employee.fullName || "Unnamed"}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{employee.employeeId || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-700 font-medium">{employee.jobRole || "N/A"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${dept.lightBg} border-${dept.textColor.split('-')[1]}-200 ${dept.textColor}`}>
                          {employee.designation || "Employee"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => router.push(`/dashboard/employees/${employee.uid}`)}
                          className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
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
    </div>
  );
}

