"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";

// Must stay in step with the status check constraint on public.candidates.
export const STATUSES = ["New", "Contacted", "Interviewing", "Selected", "Rejected", "On Hold"] as const;
export type Status = (typeof STATUSES)[number];

export interface CandidateFormState {
    full_name: string;
    phone: string;
    marketing_email: string;
    marketing_password: string;
    linkedin_email: string;
    linkedin_password: string;
    technology: string;
    visa_status: string;
    status: Status;
    assigned_to: string;
    notes: string;
}

export interface AssignableEmployee {
    id: string;
    full_name: string;
    designation: string | null;
}

export default function CandidateFormModal({
    isEditing,
    form,
    setForm,
    employees,
    technologyOptions,
    visaOptions,
    saving,
    onSubmit,
    onClose,
}: {
    isEditing: boolean;
    form: CandidateFormState;
    setForm: (updater: (f: CandidateFormState) => CandidateFormState) => void;
    employees: AssignableEmployee[];
    technologyOptions: string[];
    visaOptions: string[];
    saving: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
                <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                            {isEditing ? "Edit Candidate" : "Add Candidate"}
                        </h2>
                        <p className="text-xs font-semibold text-slate-500 mt-1">
                            Assign a candidate to a marketing employee
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Candidate Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.full_name}
                                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                                placeholder="e.g. Kaushal Mehta"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Contact Number
                            </label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                placeholder="e.g. (551) 323-3630"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Marketing Email
                            </label>
                            <input
                                type="email"
                                value={form.marketing_email}
                                onChange={(e) => setForm((f) => ({ ...f, marketing_email: e.target.value }))}
                                placeholder="candidate@gmail.com"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Marketing Email Password
                            </label>
                            <input
                                type="text"
                                value={form.marketing_password}
                                onChange={(e) => setForm((f) => ({ ...f, marketing_password: e.target.value }))}
                                placeholder="e.g. Vectra@1234"
                                autoComplete="off"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                LinkedIn Email
                            </label>
                            <input
                                type="email"
                                value={form.linkedin_email}
                                onChange={(e) => setForm((f) => ({ ...f, linkedin_email: e.target.value }))}
                                placeholder="candidate@gmail.com"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                LinkedIn Password
                            </label>
                            <input
                                type="text"
                                value={form.linkedin_password}
                                onChange={(e) => setForm((f) => ({ ...f, linkedin_password: e.target.value }))}
                                placeholder="e.g. Vectra@1234"
                                autoComplete="off"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Technology
                            </label>
                            <input
                                type="text"
                                list="candidate-technology-options"
                                value={form.technology}
                                onChange={(e) => setForm((f) => ({ ...f, technology: e.target.value }))}
                                placeholder="e.g. Data Scientist"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                            <datalist id="candidate-technology-options">
                                {technologyOptions.map((opt) => (
                                    <option key={opt} value={opt} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Visa Status
                            </label>
                            <input
                                type="text"
                                list="candidate-visa-options"
                                value={form.visa_status}
                                onChange={(e) => setForm((f) => ({ ...f, visa_status: e.target.value }))}
                                placeholder="e.g. F1 STEM OPT"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                            <datalist id="candidate-visa-options">
                                {visaOptions.map((opt) => (
                                    <option key={opt} value={opt} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Status
                            </label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
                                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm cursor-pointer"
                            >
                                {STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Assign To
                            </label>
                            <select
                                value={form.assigned_to}
                                onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm cursor-pointer"
                            >
                                <option value="">Unassigned</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.full_name}
                                        {emp.designation ? ` - ${emp.designation}` : ""}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                                Only the assigned employee can see this candidate.
                            </p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Notes
                            </label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                placeholder="Any details the assigned employee should know..."
                                rows={3}
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-md"
                        >
                            {saving ? "Saving..." : isEditing ? "Save changes" : "Add candidate"}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
