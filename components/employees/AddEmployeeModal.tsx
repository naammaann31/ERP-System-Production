"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Plus, Check, ChevronDown, X } from "lucide-react";
import { registerEmployeeByAdmin } from "@/lib/auth";

interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AddEmployeeModal({ isOpen, onClose }: AddEmployeeModalProps) {
    const [fullName, setFullName] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("Admin");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [designation, setDesignation] = useState("");
    const [employmentType, setEmploymentType] = useState("Full-Time");

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

        if (!fullName || !employeeId || !email || !password || !confirmPassword || !role || !designation || !employmentType) {
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

        const { error: signUpError } = await registerEmployeeByAdmin(
            fullName, 
            employeeId, 
            email, 
            role, 
            password, 
            designation, 
            employmentType
        );

        if (signUpError) {
            setError(signUpError);
            setLoading(false);
            return;
        }

        alert("Employee account created successfully!");
        setLoading(false);
        // Reset form
        setFullName(""); setEmployeeId(""); setEmail(""); setRole("Admin");
        setPassword(""); setConfirmPassword(""); setDesignation(""); setEmploymentType("Full-Time");
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
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative z-10 w-full max-w-lg bg-[#111111]/90 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
                >
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full p-2"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-bold text-white tracking-widest uppercase">Register Clearance</h2>
                        <p className="text-white/50 text-xs mt-1">Create a new employee system access</p>
                    </div>

                    <form onSubmit={handleSignUp} className="space-y-4">
                        {/* Full Name & Employee ID */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">Full Name</label>
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-xs shadow-inner"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">Employee ID</label>
                                <input
                                    type="text"
                                    placeholder="Enter employee ID"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-xs shadow-inner"
                                    required
                                />
                            </div>
                        </div>

                        {/* Designation & Employment Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">Designation</label>
                                <input
                                    type="text"
                                    placeholder="Senior Engineer"
                                    value={designation}
                                    onChange={(e) => setDesignation(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-xs shadow-inner"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">Employment Type</label>
                                <select
                                    value={employmentType}
                                    onChange={(e) => setEmploymentType(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-xs shadow-inner appearance-none"
                                    required
                                >
                                    <option value="Full-Time" className="bg-slate-900 text-white">Full-Time</option>
                                    <option value="Part-Time" className="bg-slate-900 text-white">Part-Time</option>
                                    <option value="Contract" className="bg-slate-900 text-white">Contract</option>
                                    <option value="Internship" className="bg-slate-900 text-white">Internship</option>
                                </select>
                            </div>
                        </div>

                        {/* Corporate Email */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">Corporate Email</label>
                            <input
                                type="email"
                                placeholder="name@vectragroup.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-xs shadow-inner"
                                required
                            />
                        </div>

                        {/* Access Role */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">
                                Access Role <span className="text-red-400">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {/* Admin */}
                                <div
                                    onClick={() => setRole("Admin")}
                                    className={`relative p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center ${role === "Admin" ? "bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]" : "bg-black/20 border-white/10 hover:bg-white/5"}`}
                                >
                                    {role === "Admin" && (
                                        <div className="absolute top-1.5 right-1.5 bg-white rounded-full p-0.5">
                                            <Check className="w-2.5 h-2.5 text-black" />
                                        </div>
                                    )}
                                    <span className="text-xs font-bold text-white mb-1 uppercase tracking-wider">Admin</span>
                                    <span className="text-[9px] text-white/50 tracking-wider leading-tight">Full system access</span>
                                </div>
                                {/* HR */}
                                <div
                                    onClick={() => setRole("HR")}
                                    className={`relative p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center ${role === "HR" ? "bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]" : "bg-black/20 border-white/10 hover:bg-white/5"}`}
                                >
                                    {role === "HR" && (
                                        <div className="absolute top-1.5 right-1.5 bg-white rounded-full p-0.5">
                                            <Check className="w-2.5 h-2.5 text-black" />
                                        </div>
                                    )}
                                    <span className="text-xs font-bold text-white mb-1 uppercase tracking-wider">HR</span>
                                    <span className="text-[9px] text-white/50 tracking-wider leading-tight">Human resources access</span>
                                </div>
                                {/* Operations */}
                                <div className="relative h-full">
                                    <div
                                        onClick={() => setShowDropdown(!showDropdown)}
                                        className={`relative p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center h-full ${["OPS_HR", "MARKETING", "SALES", "IT"].includes(role) ? "bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]" : "bg-black/20 border-white/10 hover:bg-white/5"}`}
                                    >
                                        {["OPS_HR", "MARKETING", "SALES", "IT"].includes(role) && (
                                            <div className="absolute top-1.5 right-1.5 bg-white rounded-full p-0.5">
                                                <Check className="w-2.5 h-2.5 text-black" />
                                            </div>
                                        )}
                                        <span className="text-xs font-bold text-white mb-1 uppercase tracking-wider flex items-center justify-center gap-1">
                                            {["OPS_HR", "MARKETING", "SALES", "IT"].includes(role) ? (role === "OPS_HR" ? "HR" : role) : "Operations"}
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
                                        </span>
                                        <span className="text-[9px] text-white/50 tracking-wider leading-tight">Department access</span>
                                    </div>

                                    {showDropdown && (
                                        <div className="absolute top-full left-0 mt-2 w-full bg-[#111111] border border-white/20 rounded-xl overflow-hidden z-50 shadow-2xl">
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
                                                    className="px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 cursor-pointer uppercase tracking-wider border-b border-white/5 last:border-0"
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
                                <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">Auth Key</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="8+ chars"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:border-white/30 transition-all text-xs shadow-inner"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">Confirm Key</label>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        placeholder="Repeat"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:border-white/30 transition-all text-xs shadow-inner"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
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
                                className="bg-red-500/20 border border-red-400/30 text-red-300 px-4 py-2.5 rounded-xl text-sm"
                            >
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 bg-white hover:bg-slate-200 text-black font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 tracking-wider uppercase text-sm shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
