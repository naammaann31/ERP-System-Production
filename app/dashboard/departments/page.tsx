"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Building2, 
  Megaphone, 
  LineChart, 
  Users, 
  Monitor, 
  UserPlus,
  Briefcase,
  MoreVertical,
  Mail,
  Phone
} from "lucide-react";

// --- HR View Data ---
const baseDepartments = [
  {
    id: "marketing",
    dbRole: "MARKETING",
    name: "Marketing",
    description: "Responsible for brand management, advertising, and market research.",
    icon: Megaphone,
    color: "bg-blue-50 text-blue-600 border border-blue-100",
  },
  {
    id: "it",
    dbRole: "IT",
    name: "Information Technology",
    description: "Handles infrastructure, software development, and technical support.",
    icon: Monitor,
    color: "bg-indigo-50 text-indigo-600 border border-indigo-100",
  },
  {
    id: "sales",
    dbRole: "SALES",
    name: "Sales",
    description: "Focuses on client acquisition, revenue generation, and partnerships.",
    icon: LineChart,
    color: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  },
  {
    id: "hr",
    dbRole: "OPS_HR",
    name: "Human Resources",
    description: "Manages recruitment, employee relations, and company culture.",
    icon: Users,
    color: "bg-amber-50 text-amber-600 border border-amber-100",
  },
];

function HRDepartmentsDashboard() {
  const [stats, setStats] = useState<Record<string, { count: number, manager: string }>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      const newStats: Record<string, { count: number, manager: string }> = {};
      
      emps.forEach((emp: any) => {
        const role = emp.role || "Employee";
        if (!newStats[role]) {
          newStats[role] = { count: 0, manager: "Pending Assignment" };
        }
        
        newStats[role].count += 1;
        
        // Check if manager or lead
        const desig = (emp.designation || "").toLowerCase();
        if (desig.includes("manager") || desig.includes("lead") || desig.includes("head") || emp.role === "Admin") {
          newStats[role].manager = emp.fullName || emp.name || "Unknown";
        }
      });
      
      setStats(newStats);
    });

    return () => unsubscribe();
  }, []);

  const departments = baseDepartments.map(dept => {
    const deptStats = stats[dept.dbRole] || { count: 0, manager: "Pending Assignment" };
    return {
      ...dept,
      employeeCount: deptStats.count,
      manager: deptStats.manager
    };
  });

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Departments Overview
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage organizational structure and departments across the company.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <UserPlus className="w-4 h-4" />
            <span>Add Department</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept, index) => (
          <motion.div
            key={dept.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="h-full"
          >
            <Link href={`/dashboard/departments/${dept.id}`} className="block h-full">
              <Card className="h-full border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-lg transition-all duration-300 bg-white group flex flex-col hover:-translate-y-1">
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${dept.color.replace('ring-', 'border border-')} group-hover:scale-105 transition-transform duration-300 ease-out`}>
                        <dept.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {dept.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-500">{dept.employeeCount} Members</span>
                        </div>
                      </div>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => e.preventDefault()}>
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <p className="text-sm text-slate-600 leading-relaxed flex-1">
                    {dept.description}
                  </p>
                  
                  <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0 shadow-sm">
                        {dept.manager.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Department Head</span>
                        <span className="text-sm font-semibold text-slate-700">{dept.manager}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Employee View Data & Logic ---

const myDepartment = {
  id: "it",
  name: "Information Technology",
  description: "Handles infrastructure, software development, and technical support. Your central hub for all technical matters.",
  employeeCount: 5,
  manager: "Mohammed Hamzah Saiyed",
  icon: Monitor,
  color: "bg-indigo-50 text-indigo-600 ring-indigo-100",
};

const teamMembers = [
  { name: "Mohammed Hamzah Saiyed", role: "ML Engineer", email: "hamzah@vectra.com", isManager: true },
  { name: "Naman Trivedi", role: "Data Engineer", email: "naman@vectra.com", isManager: false },
  { name: "Piyush Soni", role: "UI/UX Designer", email: "piyush.s@vectra.com", isManager: false },
  { name: "Jaynish Vaghela", role: "Full Stack Developer Intern", email: "jaynish@vectra.com", isManager: false },
  { name: "Himanshu Gaur", role: "Cybersecurity Intern", email: "himanshu@vectra.com", isManager: false },
];

function EmployeeDepartmentDashboard() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <myDepartment.icon className="w-6 h-6 text-indigo-600" />
            My Department
          </h1>
          <p className="text-slate-500 text-sm mt-1">View your team structure and colleagues.</p>
        </div>
      </div>

      {/* Department Overview Card */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        <div className="p-8 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className={`p-5 rounded-2xl border ${myDepartment.color.replace('ring-', 'border-')} shadow-sm`}>
              <myDepartment.icon className="w-10 h-10" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-slate-900">{myDepartment.name}</h2>
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">Your Department</span>
              </div>
              <p className="text-slate-600 max-w-2xl text-sm leading-relaxed">{myDepartment.description}</p>
              
              <div className="flex flex-wrap items-center gap-8 mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 shadow-sm">
                    {myDepartment.manager.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Department Head</p>
                    <p className="text-sm font-bold text-slate-800">{myDepartment.manager}</p>
                  </div>
                </div>
                
                <div className="w-px h-10 bg-slate-100 hidden md:block" />

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 shadow-sm">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Members</p>
                    <p className="text-sm font-bold text-slate-800">{myDepartment.employeeCount} Colleagues</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Team Members */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Team Directory
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {teamMembers.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="p-5 border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 shadow-sm group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
                        {member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{member.name}</h4>
                      <p className="text-sm font-medium text-slate-500 mt-0.5">{member.role}</p>
                      {member.isManager && (
                        <span className="inline-flex mt-2.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded border border-indigo-100">
                          Manager
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title={`Email ${member.name}`}>
                      <Mail className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title={`Call ${member.name}`}>
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Page Component ---

export default function DepartmentsPage() {
  const { profile } = useAuth();
  
  if (profile?.role === "HR" || profile?.role === "Admin") {
    return <HRDepartmentsDashboard />;
  }

  return <EmployeeDepartmentDashboard />;
}
