"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

interface OperationsFormProps {
    onCancel: () => void;
    onSuccess: () => void;
}

export default function OperationsForm({ onCancel, onSuccess }: OperationsFormProps) {
    const { profile } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        "Date": "",
        "Candidate Name ": "",
        "Contact Number": "",
        "Email": "",
        "Visa Status": "",
        "Job Role": "",
        "Exp": "",
        "Location": "",
        "Internal Name": "",
        "Linkedln Profile URL": "",
        "Feedback": "",
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        
        const payload = {
            ...formData,
            "Internal Name": profile?.fullName || profile?.email || "",
            "Status": "New"
        };

        try {
            await addDoc(collection(db, "sales"), {
                ...payload,
                createdAt: serverTimestamp()
            });

            toast.success("Entry saved successfully!");
            onSuccess();
        } catch (error) {
            console.error("Error saving entry:", error);
            toast.error("Error saving entry.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 hover:border-black transition-colors p-6 md:p-8 max-w-5xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                    {/* Row 1 */}
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Date</label>
                        <input 
                            type="date" 
                            name="Date"
                            value={formData["Date"]}
                            onChange={handleInputChange}
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                            required 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Candidate name <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="Candidate Name "
                            value={formData["Candidate Name "]}
                            onChange={handleInputChange}
                            placeholder="e.g. John Doe"
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                            required 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Contact number</label>
                        <input 
                            type="text" 
                            name="Contact Number"
                            value={formData["Contact Number"]}
                            onChange={handleInputChange}
                            placeholder="e.g. +1 234 567 890"
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                        />
                    </div>

                    {/* Row 2 */}
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Email address</label>
                        <input 
                            type="email" 
                            name="Email"
                            value={formData["Email"]}
                            onChange={handleInputChange}
                            placeholder="john@example.com"
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Visa status</label>
                        <div className="relative w-full">
                            <select 
                                name="Visa Status"
                                value={formData["Visa Status"]}
                                onChange={handleInputChange}
                                className="appearance-none w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm cursor-pointer"
                            >
                                <option value="" className="text-slate-400">-- Select Status --</option>
                                <option value="H1B">H1B</option>
                                <option value="F1">F1</option>
                                <option value="F1 STEM OPT">F1 STEM OPT</option>
                                <option value="GC">GC</option>
                                <option value="USC">USC</option>
                                <option value="WP">WP</option>
                                <option value="Other">Other</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"></path>
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Job role</label>
                        <input 
                            type="text" 
                            name="Job Role"
                            value={formData["Job Role"]}
                            onChange={handleInputChange}
                            placeholder="e.g. Software Engineer"
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                        />
                    </div>

                    {/* Row 3 */}
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Experience (years)</label>
                        <input 
                            type="text" 
                            name="Exp"
                            value={formData["Exp"]}
                            onChange={handleInputChange}
                            placeholder="e.g. 5"
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Location</label>
                        <input 
                            type="text" 
                            name="Location"
                            value={formData["Location"]}
                            onChange={handleInputChange}
                            placeholder="e.g. New York, NY"
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">LinkedIn URL</label>
                        <input 
                            type="url" 
                            name="Linkedln Profile URL"
                            value={formData["Linkedln Profile URL"]}
                            onChange={handleInputChange}
                            placeholder="https://linkedin.com/in/..."
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                        />
                    </div>

                    {/* Full Width Row */}
                    <div className="space-y-2 md:col-span-3">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Feedback</label>
                        <textarea 
                            name="Feedback"
                            value={formData["Feedback"]}
                            onChange={handleInputChange}
                            rows={2}
                            placeholder="Any additional feedback or notes..."
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm resize-none" 
                        ></textarea>
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6">
                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                        {submitting ? "Saving..." : "Save entry"}
                    </button>
                    <button 
                        type="button" 
                        onClick={onCancel}
                        className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm hover:shadow-md"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
