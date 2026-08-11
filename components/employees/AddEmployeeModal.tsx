"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Plus, Check, ChevronDown, X } from "lucide-react";
import { createEmployeeAction } from "@/app/actions/employees";
import { toast } from "sonner";

interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
    const [fullName, setFullName] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [jobRole, setJobRole] = useState("");
    const [designation, setDesignation] = useState("Employee");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const validateEmail = (email: string) => {
        return /\S+@\S+\.\S+/.test(email);
    };

    const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");

        if (!fullName || !employeeId || !email || !password || !confirmPassword || !role || !jobRole || !designation) {
            setError("All fields are required.");
            return;
        }

        if (!validateEmail(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Authentication keys do not match.");
            return;
        }

        setLoading(true);

        const { error: signUpError } = await createEmployeeAction({
            fullName,
            employeeId,
            email,
            role,
            password,
            jobRole,
            designation,
        });

        if (signUpError) {
            setError(signUpError);
            setLoading(false);
            return;
        }

        toast.success("Employee account created successfully!");
        setLoading(false);
        // Reset form
        setFullName(""); setEmployeeId(""); setEmail(""); setRole("");
        setPassword(""); setConfirmPassword(""); setJobRole(""); setDesignation("Employee");
        onSuccess?.();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Dark overlay backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                />
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative z-10 w-full max-w-lg bg-white rounded-3xl p-6 border border-slate-200 hover:border-black transition-colors shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
                >
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 rounded-full p-2"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-bold text-slate-900 tracking-widest uppercase">Register Clearance</h2>
                        <p className="text-slate-500 text-xs mt-1">Create a new employee system access</p>
                    </div>

                    <form onSubmit={handleSignUp} className="space-y-4">
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

                        {/* Corporate Email */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Corporate Email</label>
                            <input
                                type="email"
                                placeholder="name@vectragroup.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                required
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
                                    className={`relative p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center ${role === "Admin" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
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
                                    className={`relative p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center ${role === "HR" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
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
                                <div className="relative h-full">
                                    <div
                                        onClick={() => setShowDropdown(!showDropdown)}
                                        className={`relative p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center h-full ${["OPS_HR", "MARKETING", "SALES", "IT"].includes(role) ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
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
                                        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl overflow-hidden z-50 shadow-lg">
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

                        {/* Auth Key & Confirm Key */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Auth Key</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="8+ chars"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Confirm Key</label>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        placeholder="Repeat"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm shadow-sm"
                            >
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 tracking-wider uppercase text-sm shadow-md hover:shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-slate-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    Create Employee
                                    <Plus className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
