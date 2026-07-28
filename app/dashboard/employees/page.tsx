"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Filter, Plus, Trash2, Download, CheckSquare } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import AddEmployeeModal from "@/components/employees/AddEmployeeModal";
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const getDepartmentColor = (department: string) => {
  switch (department) {
    case "Marketing": return "info";
    case "MARKETING": return "info";
    case "Sales": return "success";
    case "SALES": return "success";
    case "HR": return "warning";
    case "IT": return "default";
    case "Recruitment": return "secondary";
    case "Admin": return "destructive";
    default: return "default";
  }
};

export default function EmployeesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map((e: any) => e.uid)));
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdminOrHR || selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} employee(s)? This will revoke their access.`)) return;
    for (const uid of selectedIds) {
      try { await deleteDoc(doc(db, "users", uid)); } catch { /* ignore */ }
    }
    setSelectedIds(new Set());
  };

  const handleExportCSV = () => {
    const rows = filteredEmployees.filter((e: any) => selectedIds.size === 0 || selectedIds.has(e.uid));
    const csv = ["Name,Employee ID,Department,Designation", ...rows.map((e: any) => `"${e.name}","${e.id}","${e.department}","${e.designation}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "employees.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let emps1: any[] = [];
    let emps2: any[] = [];
    let loaded1 = false;
    let loaded2 = false;

    const updateEmployees = () => {
      const combined = [...emps1, ...emps2].filter((v, i, a) => a.findIndex(t => (t.uid === v.uid)) === i);
      combined.sort((a, b) => b.createdAt - a.createdAt);
      setEmployees(combined);
      if (loaded1 && loaded2) setLoading(false);
    };

    const q1 = collection(db, "users");
    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      emps1 = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        emps1.push({
          uid: doc.id,
          id: data.employeeId || "N/A",
          name: data.fullName || "Unnamed",
          department: data.role === "OPS_HR" ? "HR" : (data.role || "Employee"),
          designation: data.designation || "N/A",
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
        });
      });
      loaded1 = true;
      updateEmployees();
    });

    const q2 = collection(db, "Users");
    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      emps2 = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        emps2.push({
          uid: doc.id,
          id: data.employeeId || "N/A",
          name: data.fullName || "Unnamed",
          department: data.role === "OPS_HR" ? "HR" : (data.role || "Employee"),
          designation: data.designation || "N/A",
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
        });
      });
      loaded2 = true;
      updateEmployees();
    });
    
    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, []);

  const departments = useMemo(() => {
    const deps = new Set(employees.map(e => e.department));
    return ["All", ...Array.from(deps)];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch = 
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.designation.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = selectedDepartment === "All" || employee.department === selectedDepartment;
      
      return matchesSearch && matchesDepartment;
    });
  }, [searchQuery, selectedDepartment, employees]);

  const handleDeleteEmployee = async (uid: string, name: string) => {
    if (!isAdminOrHR) return;
    
    if (window.confirm(`Are you sure you want to delete ${name}? This will instantly revoke their access to the workspace.`)) {
      try {
        await deleteDoc(doc(db, "users", uid));
      } catch (error) {
        console.error("Error deleting employee:", error);
        alert("Failed to delete employee.");
      }
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Employees Directory
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage and view all employee details</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {isAdminOrHR && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Employee
            </button>
          )}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search employees..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="w-[160px] flex items-center text-left pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Filter className="w-4 h-4 text-slate-500" />
              </div>
              <span className="truncate">{selectedDepartment === "All" ? "Filter: All" : selectedDepartment}</span>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className={`w-4 h-4 text-slate-500 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </button>

            {isFilterOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsFilterOpen(false)} 
                />
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-20 py-2"
                >
                  <div className="px-3 pb-2 mb-2 border-b border-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Departments
                  </div>
                  {departments.map(dep => (
                    <button
                      key={dep}
                      onClick={() => {
                        setSelectedDepartment(dep);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                        selectedDepartment === dep 
                          ? 'bg-blue-50/50 text-blue-700 font-medium' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${selectedDepartment === dep ? 'bg-blue-600' : 'bg-transparent'}`} />
                      {dep === "All" ? "All Departments" : dep}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                <tr>
                  {isAdminOrHR && (
                    <th className="px-4 py-4 w-10">
                      <input type="checkbox" checked={selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer" />
                    </th>
                  )}
                  <th className="px-6 py-4 font-medium">Employee Name</th>
                  <th className="px-6 py-4 font-medium">Employee ID</th>
                  <th className="px-6 py-4 font-medium">Department</th>
                  <th className="px-6 py-4 font-medium">Designation</th>
                  {isAdminOrHR && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={isAdminOrHR ? 5 : 4} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Loading employees...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={isAdminOrHR ? 5 : 4} className="px-6 py-12 text-center text-slate-500">
                      No employees found in the database.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee, index) => (
                    <motion.tr 
                      key={employee.uid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="bg-white hover:bg-slate-50/80 transition-colors group"
                    >
                      {isAdminOrHR && (
                        <td className="px-4 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(employee.uid)} onChange={() => toggleSelect(employee.uid)} className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer" />
                        </td>
                      )}
                      <td className="px-6 py-4 font-medium text-slate-900 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => router.push(`/dashboard/employees/${employee.uid}`)}>
                        {employee.name}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                        {employee.id}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getDepartmentColor(employee.department) as any} className="font-medium px-2.5 py-0.5">
                          {employee.department}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {employee.designation}
                      </td>
                      {isAdminOrHR && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteEmployee(employee.uid, employee.name)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="Delete Employee & Revoke Access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
            <div>Showing <span className="font-medium text-slate-900">{filteredEmployees.length}</span> employees</div>
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>

          {/* Bulk Action Bar */}
          {isAdminOrHR && selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 py-3 bg-slate-900 flex items-center justify-between"
            >
              <span className="text-sm font-semibold text-white">
                <CheckSquare className="h-4 w-4 inline mr-2" />
                {selectedIds.size} selected
              </span>
              <div className="flex items-center gap-3">
                <button onClick={handleExportCSV} className="text-xs font-semibold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors">
                  <Download className="h-3.5 w-3.5 inline mr-1" /> Export
                </button>
                <button onClick={handleBulkDelete} className="text-xs font-semibold text-red-300 bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-colors">
                  <Trash2 className="h-3.5 w-3.5 inline mr-1" /> Delete
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-medium text-slate-400 hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </Card>
      </motion.div>

      <AddEmployeeModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
