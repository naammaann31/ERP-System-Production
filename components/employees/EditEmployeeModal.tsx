"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ChevronDown } from "lucide-react";
import { updateEmployeeAction } from "@/app/actions/employees";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface EditEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    employee: any;
}

export default function EditEmployeeModal({ isOpen, onClose, onSuccess, employee }: EditEmployeeModalProps) {
    const [fullName, setFullName] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");
    const [jobRole, setJobRole] = useState("");
    const [designation, setDesignation] = useState("Employee");
    const [showDropdown, setShowDropdown] = useState(false);
    const [phone, setPhone] = useState("");
    const [dateOfJoining, setDateOfJoining] = useState("");
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Load initial data
    useEffect(() => {
        if (employee && isOpen) {
            setFullName(employee.name || "");
            setEmployeeId(employee.id || "");
            setRole(employee.department === "HR" ? (employee.role === "OPS_HR" ? "OPS_HR" : "HR") : (employee.role || "Employee")); // Handle display logic
            setRole(employee.role || "Employee");
            setJobRole(employee.jobRole || "");
            setDesignation(employee.designation || "Employee");
            setPhone(employee.phone || "");
            setDateOfJoining(employee.date_of_joining || employee.dateOfJoining || "");
            
            const fetchEmail = async () => {
              const supabase = createClient();
              const { data, error } = await supabase.rpc('get_user_email', { target_uid: employee.uid }).single();
              if (data) setEmail(data as string);
            };
            fetchEmail().catch(() => setEmail(""));
        }
    }, [employee, isOpen]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!role) {
            setError("Please select an access role");
            setLoading(false);
            return;
        }

        const { error: updateError } = await updateEmployeeAction({
            uid: employee.uid,
            fullName,
            employeeId,
            email,
            role,
            jobRole,
            designation,
            phone,
            dateOfJoining
        });

        if (updateError) {
            setError(updateError);
            setLoading(false);
            return;
        }

        toast.success("Employee details updated successfully!");
        setLoading(false);
        onSuccess?.();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] overflow-y-auto custom-scrollbar">
                <div className="flex min-h-full items-center justify-center p-4">
                    {/* Dark overlay backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative z-10 w-full max-w-lg bg-white rounded-3xl p-6 border border-slate-200 hover:border-black transition-colors shadow-2xl"
                >
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 rounded-full p-2"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-bold text-slate-900 tracking-widest uppercase">Edit Clearance</h2>
                        <p className="text-slate-500 text-xs mt-1">Update employee details and system access</p>
                    </div>

                    <form onSubmit={handleUpdate} className="space-y-4">
                        {/* Full Name & Employee ID */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Full Name</label>
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Employee ID</label>
                                <input
                                    type="text"
                                    placeholder="Enter employee ID"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                    required
                                />
                            </div>
                        </div>

                        {/* Job Role & Designation */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Job Role</label>
                                <input
                                    type="text"
                                    placeholder="Senior Engineer"
                                    value={jobRole}
                                    onChange={(e) => setJobRole(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Designation</label>
                                <select
                                    value={designation}
                                    onChange={(e) => setDesignation(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm appearance-none"
                                    required
                                >
                                    <option value="Intern">Intern</option>
                                    <option value="Employee">Employee</option>
                                    <option value="Team-Lead">Team-Lead</option>
                                    <option value="Manager">Manager</option>
                                </select>
                            </div>
                        </div>

                        {/* Corporate Email & Phone Number */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Corporate Email</label>
                                <input
                                    type="email"
                                    placeholder="Leave blank to keep current email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Phone Number</label>
                                <input
                                    type="tel"
                                    placeholder="+1 234 567 8900"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Date Of Joining */}
                        <div>
                             <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Date Of Joining</label>
                             <input
                                 type="date"
                                 value={dateOfJoining}
                                 onChange={(e) => setDateOfJoining(e.target.value)}
                                 className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm text-slate-500"
                             />
                        </div>

                        {/* Access Role */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Access Role <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Admin */}
                                <div
                                    onClick={() => setRole("Admin")}
                                    className={`relative h-24 p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center ${role === "Admin" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
                                >
                                    {role === "Admin" && (
                                        <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                    <span className="text-xs font-bold mb-1 uppercase tracking-wider">Admin</span>
                                    <span className={`text-[10px] ${role === "Admin" ? "text-blue-600/80" : "text-slate-500"} tracking-wider leading-tight`}>Full system access</span>
                                </div>
                                {/* HR */}
                                <div
                                    onClick={() => setRole("HR")}
                                    className={`relative h-24 p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center ${role === "HR" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
                                >
                                    {role === "HR" && (
                                        <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                    <span className="text-xs font-bold mb-1 uppercase tracking-wider">HR</span>
                                    <span className={`text-[10px] ${role === "HR" ? "text-blue-600/80" : "text-slate-500"} tracking-wider leading-tight`}>Human resources access</span>
                                </div>
                                {/* Operations */}
                                <div className="relative">
                                    <div
                                        onClick={() => setShowDropdown(!showDropdown)}
                                        className={`relative h-24 p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center ${["OPS_HR", "MARKETING", "SALES", "IT"].includes(role) ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
                                    >
                                        {["OPS_HR", "MARKETING", "SALES", "IT"].includes(role) && (
                                            <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <span className="text-xs font-bold mb-1 uppercase tracking-wider flex items-center justify-center gap-1">
                                            {["OPS_HR", "MARKETING", "SALES", "IT"].includes(role) ? (role === "OPS_HR" ? "HR" : role) : "Operations"}
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
                                        </span>
                                        <span className={`text-[10px] ${["OPS_HR", "MARKETING", "SALES", "IT"].includes(role) ? "text-blue-600/80" : "text-slate-500"} tracking-wider leading-tight`}>Department access</span>
                                    </div>

                                    {showDropdown && (
                                        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl overflow-hidden z-[60] shadow-xl">
                                            {[
                                                { label: "HR", value: "OPS_HR" },
                                                { label: "MARKETING", value: "MARKETING" },
                                                { label: "SALES", value: "SALES" },
                                                { label: "IT", value: "IT" }
                                            ].map((opRole) => (
                                                <div
                                                    key={opRole.value}
                                                    onClick={() => {
                                                        setRole(opRole.value);
                                                        setShowDropdown(false);
                                                    }}
                                                    className="px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-600 cursor-pointer uppercase tracking-wider border-b border-slate-100 last:border-0 transition-colors"
                                                >
                                                    {opRole.label}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-center gap-2">
                                <span className="font-semibold uppercase tracking-wider text-[10px]">Error:</span> {error}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Saving Changes...
                                    </>
                                ) : (
                                    'Update Employee'
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
                </div>
            </div>
        </AnimatePresence>
    );
}
