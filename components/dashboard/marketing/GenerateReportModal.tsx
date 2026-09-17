"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitMarketingDailyReport } from "@/app/actions/marketing";
import { toast } from "sonner";

export default function GenerateReportModal({ isOpen, onClose, profile, startDate, endDate, displayData }: { isOpen: boolean, onClose: () => void, profile: any, startDate: string, endDate: string, displayData: any[] }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ candidates: 0, applications: 0, screenings: 0, interviews: 0, breakdown: [] as {name: string, applications: number}[] });
    const [rtr, setRtr] = useState("");

    useEffect(() => {
        if (!isOpen || !profile) return;
        const fetchStats = async () => {
            const supabase = createClient();

            // Applications (Leads in current UI view)
            const applicationsCount = displayData.length;

            // Interviews/Screenings based on same date filters
            let query = supabase
                .from("interview_screening")
                .select("stage")
                .eq("created_by", profile.uid);

            if (startDate) query = query.gte("date", startDate);
            if (endDate) query = query.lte("date", endDate);

            const { data: isData } = await query;

            let screenings = 0;
            let interviews = 0;
            if (isData) {
                isData.forEach(r => {
                    const stage = r.stage || "";
                    if (stage.toLowerCase().includes("screening") || stage.toLowerCase().includes("ai")) {
                        screenings++;
                    } else {
                        interviews++;
                    }
                });
            }

                        // Number of unique candidates from the leads table view
            const breakdownObj: Record<string, number> = {};
            displayData.forEach(d => {
                const name = d.Name || d.CandidateName || "Unknown";
                breakdownObj[name] = (breakdownObj[name] || 0) + 1;
            });
            const breakdownArray = Object.keys(breakdownObj).map(k => ({ name: k, applications: breakdownObj[k] }));

            setStats({
                candidates: breakdownArray.length,
                applications: applicationsCount,
                screenings,
                interviews,
                breakdown: breakdownArray
            });
        };
        fetchStats();
    }, [isOpen, profile, startDate, endDate]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split("T")[0];

            await submitMarketingDailyReport({
                user_id: profile.uid,
                user_name: profile.fullName || "Unknown",
                report_date: today,
                no_of_candidates: stats.candidates,
                applications: stats.applications,
                rtr_submissions: parseInt(rtr) || 0,
                screenings: stats.screenings,
                interviews: stats.interviews,
                candidate_breakdown: stats.breakdown
            });

            toast.success("Daily report sent to Team Lead successfully!");
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Failed to submit report");
        } finally {
            setLoading(false);
        }
    };

return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
                    <div>
                        <h3 className="font-black text-slate-900 text-lg">Generate Daily Report</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Fill in your daily marketing metrics</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
                        <input type="text" value={profile?.fullName || ""} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No of Candidates</label>
                            <input type="number" value={stats.candidates} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Applications</label>
                            <input type="number" value={stats.applications} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">RTR Submissions</label>
                            <input type="number" value={rtr} onChange={e => setRtr(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Screenings</label>
                            <input type="number" value={stats.screenings} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interviews</label>
                            <input type="number" value={stats.interviews} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                    <button type="button" onClick={handleSubmit} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">{loading ? "Sending..." : "Submit to Team Lead"}</button>
                </div>
            </div>
        </div>
    );
}
