"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ChevronDown, Camera } from "lucide-react";
import LinkedInIcon from "@/components/ui/LinkedInIcon";
import { updateEmployeeAction } from "@/app/actions/employees";
import { getShifts, type Shift } from "@/lib/shifts";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { uploadAvatar, AvatarUploadError } from "@/lib/avatar";

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
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("");
    const [jobRole, setJobRole] = useState("");
    const [designation, setDesignation] = useState("Employee");
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [shiftId, setShiftId] = useState("");
    const [status, setStatus] = useState("Active");
    const [showDropdown, setShowDropdown] = useState(false);
    const [phone, setPhone] = useState("");
    const [dateOfJoining, setDateOfJoining] = useState("");
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);

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
            setShiftId(employee.shiftId || "");
            setStatus(employee.status || "Active");
            setPhone(employee.phone || "");
            setDateOfJoining(employee.date_of_joining || employee.dateOfJoining || "");
            setAvatarUrl(employee.avatarThumbUrl || employee.avatar_thumb_url || employee.avatarUrl || employee.avatar_url || "");
            setLinkedinUrl(employee.linkedinUrl || employee.linkedin_url || "");
            setPassword("");
            
            const fetchEmail = async () => {
              const supabase = createClient();
              const { data, error } = await supabase.rpc('get_user_email', { target_uid: employee.uid }).single();
              if (data) setEmail(data as string);
            };
            fetchEmail().catch(() => setEmail(""));
        }
    }, [employee, isOpen]);

    useEffect(() => {
        if (isOpen) {
            getShifts().then(setShifts).catch(() => setShifts([]));
        }
    }, [isOpen]);

    const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !employee?.uid) return;

        setUploadingPhoto(true);
        try {
            const { avatarThumbUrl } = await uploadAvatar(file, employee.uid);
            setAvatarUrl(avatarThumbUrl);
            toast.success("Photo updated.");
            onSuccess?.();
        } catch (err) {
            console.error("Avatar upload failed:", err);
            const message = err instanceof AvatarUploadError ? err.message : "Failed to upload photo.";
            toast.error(message);
        }
        setUploadingPhoto(false);
        if (photoInputRef.current) photoInputRef.current.value = "";
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!role) {
            setError("Please select an access role");
            setLoading(false);
            return;
        }

        if (!shiftId) {
            setError("Please select a shift timing");
            setLoading(false);
            return;
        }

        const trimmedLinkedin = linkedinUrl.trim();
        if (trimmedLinkedin && !/^https?:\/\/.+/i.test(trimmedLinkedin)) {
            setError("LinkedIn URL must start with http:// or https://");
            setLoading(false);
            return;
        }

        const { error: updateError } = await updateEmployeeAction({
            uid: employee.uid,
            fullName,
            employeeId,
            email,
            password,
            role,
            jobRole,
            designation,
            shiftId,
            status,
            phone,
            dateOfJoining,
            linkedinUrl: trimmedLinkedin,
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
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
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

                    <div className="flex items-center justify-center mb-6">
                        <div className="relative group">
                            <Avatar
                                src={avatarUrl}
                                alt={fullName}
                                fallback={(fullName || "U").split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                                size="2xl"
                                className="border border-slate-200 shadow-sm"
                                fallbackClassName="bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-2xl"
                            />
                            <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-md border-2 border-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                title="Change photo"
                            >
                                {uploadingPhoto ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Camera className="w-3.5 h-3.5" />
                                )}
                            </button>
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                onChange={handlePhotoSelected}
                            />
                        </div>
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
                                    <option value="Immigration Manager">Immigration Manager</option>
                                    <option value="Immigration HR">Immigration HR</option>
                                </select>
                            </div>
                        </div>

                        {/* Shift Timing */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Shift Timing</label>
                            <select
                                value={shiftId}
                                onChange={(e) => setShiftId(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm appearance-none"
                                required
                            >
                                <option value="" disabled>Select a shift</option>
                                {shifts.map((shift) => (
                                    <option key={shift.id} value={shift.id}>
                                        {shift.name} ({shift.startTime.slice(0, 5)} - {shift.shiftEndTime.slice(0, 5)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Employment Status */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Employment Status</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div
                                    onClick={() => setStatus("Active")}
                                    className={`relative h-14 px-3 rounded-xl border cursor-pointer transition-all flex items-center justify-center text-center ${status === "Active" ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
                                >
                                    <span className="text-xs font-bold uppercase tracking-wider">Active</span>
                                </div>
                                <div
                                    onClick={() => setStatus("Inactive")}
                                    className={`relative h-14 px-3 rounded-xl border cursor-pointer transition-all flex items-center justify-center text-center ${status === "Inactive" ? "bg-slate-200 border-slate-400 text-slate-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
                                >
                                    <span className="text-xs font-bold uppercase tracking-wider">Inactive (Ex-Employee)</span>
                                </div>
                            </div>
                            {status === "Inactive" && (
                                <p className="text-[10px] text-amber-600 mt-1.5">This employee will be hidden from assignment dropdowns and pushed to the bottom of employee lists. Their attendance, payroll, and other historical records remain fully intact.</p>
                            )}
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

                        {/* LinkedIn URL */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">LinkedIn URL</label>
                            <div className="relative">
                                <LinkedInIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#0A66C2]" />
                                <input
                                    type="url"
                                    placeholder="https://www.linkedin.com/in/employee-name"
                                    value={linkedinUrl}
                                    onChange={(e) => setLinkedinUrl(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Admin Password Reset */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">New Password (Optional)</label>
                            <input
                                type="text"
                                placeholder="Type here to forcefully reset the employee's password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm shadow-sm"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Leave blank unless you are explicitly trying to overwrite this employee's password.</p>
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
                                        className={`relative h-24 p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center ${["OPS_HR", "MARKETING", "SALES", "IT", "IMMIGRATION"].includes(role) ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
                                    >
                                        {["OPS_HR", "MARKETING", "SALES", "IT", "IMMIGRATION"].includes(role) && (
                                            <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <span className="text-xs font-bold mb-1 uppercase tracking-wider flex items-center justify-center gap-1">
                                            {["OPS_HR", "MARKETING", "SALES", "IT", "IMMIGRATION"].includes(role) ? (role === "OPS_HR" ? "HR" : role) : "Operations"}
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
                                        </span>
                                        <span className={`text-[10px] ${["OPS_HR", "MARKETING", "SALES", "IT", "IMMIGRATION"].includes(role) ? "text-blue-600/80" : "text-slate-500"} tracking-wider leading-tight`}>Department access</span>
                                    </div>

                                    {showDropdown && (
                                        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl overflow-hidden z-[60] shadow-xl">
                                            {[
                                                { label: "HR", value: "OPS_HR" },
                                                { label: "MARKETING", value: "MARKETING" },
                                                { label: "SALES", value: "SALES" },
                                                { label: "IT", value: "IT" },
                                                { label: "IMMIGRATION", value: "IMMIGRATION" }
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


