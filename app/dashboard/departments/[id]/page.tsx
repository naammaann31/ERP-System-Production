"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as xlsx from "xlsx";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card } from "@/components/ui/card";
import { 
  Building2, 
  Megaphone, 
  LineChart, 
  Users, 
  Monitor,
  ChevronLeft,
  Briefcase,
  MapPin,
  MoreVertical,
  Activity,
  Trash2,
  Search,
  Upload
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
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  
  const [salesSearchQuery, setSalesSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  const id = params.id as string;
  const dept = DEPARTMENTS[id];

  useEffect(() => {
    if (!dept) return;

    let emps1: any[] = [];
    let emps2: any[] = [];
    let loaded1 = false;
    let loaded2 = false;

    const updateEmployees = () => {
      if (loaded1 && loaded2) {
        // Combine and filter duplicates
        const allEmps = [...emps1, ...emps2];
        const unique = Array.from(new Map(allEmps.map(item => [item.uid, item])).values());
        
        // Filter by role
        const filtered = unique.filter(emp => emp.role === dept.role);
        setEmployees(filtered);
        setLoading(false);
      }
    };

    const q1 = collection(db, "users");
    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      emps1 = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        emps1.push({ uid: doc.id, ...data });
      });
      loaded1 = true;
      updateEmployees();
    });

    const q2 = collection(db, "Users");
    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      emps2 = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        emps2.push({ uid: doc.id, ...data });
      });
      loaded2 = true;
      updateEmployees();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [dept]);

  useEffect(() => {
    if (id !== "sales") return;

    const q = collection(db, "sales");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      // Sort by date descending
      data.sort((a, b) => {
        const dateA = new Date(a["Date"] || 0).getTime();
        const dateB = new Date(b["Date"] || 0).getTime();
        return dateB - dateA;
      });
      setSalesData(data);
    });

    return () => unsubscribe();
  }, [id]);

  const filteredSalesData = salesData.filter((row) => {
    if (!salesSearchQuery) return true;
    const query = salesSearchQuery.toLowerCase().replace(/[\s\-_]/g, '');
    const normalize = (val: any) => String(val || "").toLowerCase().replace(/[\s\-_]/g, '');

    const matchesName = normalize(row["Candidate Name "]).includes(query);
    const matchesEmail = normalize(row["Email"]).includes(query);
    const matchesContact = normalize(row["Contact Number"]).includes(query);
    const matchesRole = normalize(row["Job Role"]).includes(query);
    const matchesInternal = normalize(row["Internal Name"]).includes(query);
    const matchesVisa = normalize(row["Visa Status"]).includes(query);
    const matchesLocation = normalize(row["Location"]).includes(query);
    const matchesStatus = normalize(row["Status"]).includes(query);
    const matchesExp = normalize(row["Exp"]).includes(query);
    
    if (!(matchesName || matchesEmail || matchesContact || matchesRole || matchesInternal || matchesVisa || matchesLocation || matchesStatus || matchesExp)) return false;

    if (!startDate && !endDate) return true;
    const rowDateStr = row["Date"];
    if (!rowDateStr) return false;
    
    const rowDate = new Date(rowDateStr);
    if (isNaN(rowDate.getTime())) return false;
    
    if (startDate) {
        const sDate = new Date(startDate);
        if (rowDate < sDate) return false;
    }
    if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (rowDate > eDate) return false;
    }
  }).sort((a, b) => {
      const dateA = new Date(a["Date"] || 0).getTime();
      const dateB = new Date(b["Date"] || 0).getTime();
      
      if (dateB !== dateA) {
          return dateB - dateA;
      }

      // Secondary sort by createdAt timestamp
      const createdA = a.createdAt?.seconds || 0;
      const createdB = b.createdAt?.seconds || 0;
      return createdB - createdA;
  });

  const handleExport = () => {
      const exportData = filteredSalesData.map(row => {
          const { id, createdAt, ...rest } = row;
          // Format the date to be readable in Excel
          if (rest["Date"]) {
              const dateObj = new Date(rest["Date"]);
              if (!isNaN(dateObj.getTime())) {
                  rest["Date"] = dateObj.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
              }
          }
          return rest;
      });

      const worksheet = xlsx.utils.json_to_sheet(exportData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "SalesData");
      
      xlsx.writeFile(workbook, `admin_sales_data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(filteredSalesData.map(r => r.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const handleFeedbackChange = async (row: any, newFeedback: string) => {
    if (row["Feedback"] === newFeedback) return;
    
    // Optimistic update
    setSalesData(prev => prev.map(r => r.id === row.id ? { ...r, Feedback: newFeedback } : r));

    if (!row.id) return;
    try {
        const docRef = doc(db, "sales", row.id);
        await updateDoc(docRef, { Feedback: newFeedback });
    } catch (e) {
        console.error("Error updating feedback", e);
        // Data will automatically revert because onSnapshot will fetch the correct remote state soon, 
        // but to be safe we could re-trigger it. In this component, onSnapshot is active.
    }
  };

  const handleBulkDelete = async () => {
    try {
      const promises = selectedRows.map(rowId => deleteDoc(doc(db, "sales", rowId)));
      await Promise.all(promises);
      setSelectedRows([]);
      setBulkDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting multiple records:", error);
      alert("Error deleting records.");
    }
  };

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

  const Icon = dept.icon;

  const getDepartmentHead = () => {
    const head = employees.find(emp => 
        (emp.designation && ["Team-Lead", "Manager"].includes(emp.designation)) ||
        (emp.jobRole && emp.jobRole.toLowerCase().includes("senior")) ||
        (emp.jobRole && emp.jobRole.toLowerCase().includes("head")) ||
        (emp.jobRole && emp.jobRole.toLowerCase().includes("lead"))
    );
    return head ? (head.fullName || "Unnamed") : dept.manager;
  };

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;
    try {
      await deleteDoc(doc(db, "sales", saleToDelete));
      setDeleteModalOpen(false);
      setSaleToDelete(null);
    } catch (error) {
      console.error("Error deleting sale record:", error);
      alert("Error deleting record.");
    }
  };

  const handleTextareaResize = (element: HTMLTextAreaElement | null) => {
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }
  };

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

      {/* Sales Data Table */}
      {id === "sales" && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.6 }}
        >
          <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-emerald-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Sales & Leads Data
                  <span className="bg-emerald-200 text-emerald-800 text-xs py-0.5 px-2.5 rounded-full font-semibold">
                    {filteredSalesData.length}
                  </span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">Real-time candidate data generated by the sales team.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0 justify-end flex-1">
                <div className="relative w-full sm:w-auto flex-1 sm:max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search candidates..."
                    value={salesSearchQuery}
                    onChange={(e) => setSalesSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm overflow-x-auto w-fit">
                    <div className="flex items-center space-x-2 px-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">From</span>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-700 bg-slate-50 transition-colors"
                      />
                    </div>
                    <div className="h-5 w-px bg-slate-200"></div>
                    <div className="flex items-center space-x-2 px-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">To</span>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-700 bg-slate-50 transition-colors"
                      />
                    </div>
                    {(startDate || endDate) && (
                      <button 
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {profile?.role === "Admin" && selectedRows.length > 0 && (
                    <button
                      onClick={() => setBulkDeleteModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-semibold text-sm rounded-xl transition-all border border-red-200 shadow-sm whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete ({selectedRows.length})
                    </button>
                  )}
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-semibold text-sm rounded-xl transition-all border border-emerald-200 shadow-sm whitespace-nowrap"
                    title="Export as Excel"
                  >
                    <Upload className="w-4 h-4" />
                    Export XL
                  </button>
                </div>
              </div>
            </div>
            
            <div className="overflow-auto h-[600px] max-h-[calc(100vh-280px)] custom-scrollbar pb-6">
              <table className="w-full text-sm text-left relative">
                <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {profile?.role === "Admin" && (
                      <th className="px-6 py-4 font-semibold whitespace-nowrap w-12">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          checked={filteredSalesData.length > 0 && selectedRows.length === filteredSalesData.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                    )}
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Date</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Candidate Name</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Contact Number</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Email</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Visa Status</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Feedback</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Job Role</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Exp</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Location</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Internal Name</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">LinkedIn Profile URL</th>
                    {profile?.role === "Admin" && (
                      <th className="px-6 py-4 font-semibold whitespace-nowrap text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSalesData.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-6 py-12 text-center text-slate-500">
                        No sales data found.
                      </td>
                    </tr>
                  ) : (
                    filteredSalesData.map((row, index) => (
                      <motion.tr 
                        key={row.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.5) }}
                        className={`hover:bg-slate-100 transition-colors group ${selectedRows.includes(row.id) ? 'bg-emerald-50/30' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                      >
                        {profile?.role === "Admin" && (
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              checked={selectedRows.includes(row.id)}
                              onChange={() => handleSelectRow(row.id)}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {row["Date"] ? new Date(row["Date"]).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : "-"}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                          {row["Candidate Name "] || "-"}
                        </td>
                        <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                          {row["Contact Number"] || "-"}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                          {row["Email"] || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            !row["Visa Status"] ? "bg-slate-100 text-slate-600" :
                            row["Visa Status"].includes("USC") || row["Visa Status"].includes("GC") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            row["Visa Status"].includes("H1B") ? "bg-blue-50 text-blue-700 border border-blue-200" :
                            row["Visa Status"].includes("F1") ? "bg-purple-50 text-purple-700 border border-purple-200" :
                            "bg-slate-50 text-slate-600 border border-slate-200"
                          }`}>
                            {row["Visa Status"] || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="relative inline-block min-w-[120px] max-w-[160px]">
                            <span className={`inline-flex w-full items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                              row.Status === "Success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              row.Status === "Interested" ? "bg-purple-50 text-purple-700 border-purple-200" :
                              row.Status === "Not interested" ? "bg-rose-50 text-rose-700 border-rose-200" :
                              row.Status === "Ringing" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-slate-50 text-slate-600 border-slate-200"
                            }`}>
                              <span className="truncate">{row.Status || "New"}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <textarea 
                              ref={handleTextareaResize}
                              onInput={(e) => handleTextareaResize(e.target as HTMLTextAreaElement)}
                              defaultValue={row["Feedback"] || ""}
                              onBlur={(e) => handleFeedbackChange(row, e.target.value)}
                              className="text-sm text-slate-700 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-md p-2 min-w-[200px] max-w-[350px] resize-none transition-all outline-none w-full shadow-sm overflow-hidden"
                              rows={1}
                              placeholder="Click to add feedback..."
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 whitespace-normal min-w-[150px] max-w-[250px] break-words">
                            {row["Job Role"] || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                          {row["Exp"] || "-"}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                          {row["Location"] || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                          {row["Internal Name"] || "-"}
                        </td>
                        <td className="px-6 py-4 text-xs text-blue-600 hover:underline whitespace-nowrap">
                          {row["Linkedln Profile URL"] ? (
                            <a href={row["Linkedln Profile URL"]} target="_blank" rel="noopener noreferrer">
                              {String(row["Linkedln Profile URL"]).substring(0, 30)}...
                            </a>
                          ) : "-"}
                        </td>
                        {profile?.role === "Admin" && (
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <button 
                              onClick={() => {
                                setSaleToDelete(row.id);
                                setDeleteModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              title="Delete record"
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
          </Card>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Candidate</h3>
              <p className="text-slate-500 text-sm">
                Are you sure you want to delete this candidate? This action cannot be undone and will permanently remove this data.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button 
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSaleToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteSale}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
              >
                Yes, delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete {selectedRows.length} Candidates</h3>
              <p className="text-slate-500 text-sm">
                Are you sure you want to delete {selectedRows.length} candidates? This action cannot be undone and will permanently remove this data.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button 
                onClick={() => setBulkDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
              >
                Yes, delete all
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
