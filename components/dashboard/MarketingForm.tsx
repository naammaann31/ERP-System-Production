"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { marketingUiToRow } from "@/lib/salesMarketingMap";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

interface MarketingFormProps {
    onCancel: () => void;
    onSuccess: () => void;
}

export default function MarketingForm({ onCancel, onSuccess }: MarketingFormProps) {
    const { profile } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    
    // Default to today's date
    const today = new Date().toISOString().split('T')[0];
    
    const [formData, setFormData] = useState({
        "Name": profile?.fullName || "",
        "Date": today,
        "Company Name": "",
        "Link": "",
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("marketing")
                .insert(marketingUiToRow(formData, profile?.uid || null, profile?.fullName || null));
            if (error) throw error;

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
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 hover:border-black transition-colors p-6 md:p-8 max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Name <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="Name"
                            value={formData["Name"]}
                            onChange={handleInputChange}
                            placeholder="Your Name"
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                            required 
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Date <span className="text-red-500">*</span></label>
                        <input 
                            type="date" 
                            name="Date"
                            value={formData["Date"]}
                            onChange={handleInputChange}
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                            required 
                        />
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Company Name <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="Company Name"
                            value={formData["Company Name"]}
                            onChange={handleInputChange}
                            placeholder="e.g. DaBella"
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                            required 
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Link</label>
                        <input 
                            type="url" 
                            name="Link"
                            value={formData["Link"]}
                            onChange={handleInputChange}
                            placeholder="https://..."
                            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                        />
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
