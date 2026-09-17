"use client";

import { motion } from "framer-motion";
import { CalendarClock, PhoneCall, X } from "lucide-react";
import { Section } from "@/lib/interviewScreeningExcelImport";

export interface AddEntryForm {
    section: Section;
    date: string;
    candidate: string;
    client: string;
    stage: string;
    recruiter: string;
    remarks: string;
}

export default function AddEntryModal({
    form,
    setForm,
    remarkOptions,
    saving,
    onSubmit,
    onClose,
}: {
    form: AddEntryForm;
    setForm: (updater: (f: AddEntryForm) => AddEntryForm) => void;
    remarkOptions: string[];
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
                        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Add Data</h2>
                        <p className="text-xs font-semibold text-slate-500 mt-1">Adds a new Interview or Screening record</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-6 space-y-5">
                    {/* Section selector */}
                    <div>
                        <label className="block mb-2 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Section</label>
                        <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-xl w-fit border border-slate-200">
                            {(["interview", "screening"] as Section[]).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setForm((f) => ({ ...f, section: s }))}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                                        form.section === s ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-900"
                                    }`}
                                >
                                    {s === "interview" ? <CalendarClock className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Date</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                Candidate <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.candidate}
                                onChange={(e) => setForm((f) => ({ ...f, candidate: e.target.value }))}
                                placeholder="e.g. Kaushal"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Client</label>
                            <input
                                type="text"
                                value={form.client}
                                onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                                placeholder="e.g. Kollabio"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                {form.section === "interview" ? "Stage (No of Round)" : "Screening / AI"}
                            </label>
                            <input
                                type="text"
                                value={form.stage}
                                onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                                placeholder={form.section === "interview" ? "e.g. Video interview" : "e.g. Screening call"}
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Recruiter</label>
                            <input
                                type="text"
                                value={form.recruiter}
                                onChange={(e) => setForm((f) => ({ ...f, recruiter: e.target.value }))}
                                placeholder="e.g. Pritesh"
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Remarks</label>
                            <input
                                type="text"
                                list="remark-options"
                                value={form.remarks}
                                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                                placeholder="Select or type..."
                                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                            />
                            <datalist id="remark-options">
                                {remarkOptions.map((opt) => (
                                    <option key={opt} value={opt} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-md"
                        >
                            {saving ? "Saving..." : "Save entry"}
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
