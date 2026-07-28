"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/AuthProvider";
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
const departments = [
  {
    id: "marketing",
    name: "Marketing",
    description: "Responsible for brand management, advertising, and market research.",
    employeeCount: 5,
    manager: "Asrar Patni",
    icon: Megaphone,
    color: "bg-blue-50 text-blue-600 ring-blue-100",
  },
  {
    id: "it",
    name: "Information Technology",
    description: "Handles infrastructure, software development, and technical support.",
    employeeCount: 5,
    manager: "Mohammed Hamzah Saiyed",
    icon: Monitor,
    color: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  },
  {
    id: "sales",
    name: "Sales",
    description: "Focuses on client acquisition, revenue generation, and partnerships.",
    employeeCount: 2,
    manager: "Piyush Barad",
    icon: LineChart,
    color: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  },
  {
    id: "hr",
    name: "Human Resources",
    description: "Manages recruitment, employee relations, and company culture.",
    employeeCount: 2,
    manager: "Damini Mallick",
    icon: Users,
    color: "bg-amber-50 text-amber-600 ring-amber-100",
  },
  {
    id: "recruitment",
    name: "Recruitment",
    description: "Dedicated to sourcing, interviewing, and onboarding new talent.",
    employeeCount: 2,
    manager: "Krushna Ch. Parida",
    icon: UserPlus,
    color: "bg-purple-50 text-purple-600 ring-purple-100",
  },
  {
    id: "admin",
    name: "Administration",
    description: "Oversees daily office operations, immigration, and facility management.",
    employeeCount: 1,
    manager: "Munish Kumar",
    icon: Briefcase,
    color: "bg-rose-50 text-rose-600 ring-rose-100",
  }
];

function HRDepartmentsDashboard() {
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
          >
            <Card className="h-full border-slate-200/60 hover:shadow-md transition-shadow duration-300 overflow-hidden group cursor-pointer bg-white">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ring-1 ${dept.color} group-hover:scale-110 transition-transform duration-300 ease-out`}>
                    <dept.icon className="w-6 h-6" />
                  </div>
                  <button className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
                
                <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {dept.name}
                </h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-6 h-10">
                  {dept.description}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Manager</span>
                    <span className="text-sm font-medium text-slate-700">{dept.manager}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Members</span>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">{dept.employeeCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
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
      <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none" />
        <div className="p-6 md:p-8 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className={`p-5 rounded-2xl ring-1 ${myDepartment.color}`}>
              <myDepartment.icon className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{myDepartment.name}</h2>
              <p className="text-slate-600 max-w-2xl">{myDepartment.description}</p>
              <div className="flex items-center gap-8 mt-5 pt-5 border-t border-slate-100">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department Head</p>
                  <p className="text-sm font-bold text-slate-800">{myDepartment.manager}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Members</p>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-bold text-slate-800">{myDepartment.employeeCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Team Members */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500" />
          Team Directory
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="p-5 border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{member.name}</h4>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">{member.role}</p>
                    {member.isManager && (
                      <span className="inline-block mt-3 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded border border-indigo-100">
                        Manager
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
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
