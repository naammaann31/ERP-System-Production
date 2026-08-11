"use client";

import React, { useState } from "react";
import { BarChart3, CalendarClock } from "lucide-react";
import MarketingClient from "@/components/dashboard/MarketingClient";
import InterviewScreeningClient from "@/components/dashboard/InterviewScreeningClient";

type DataView = "leads" | "interview";

export default function DataPage() {
    const [view, setView] = useState<DataView>("leads");

    return (
        <div className="h-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Marketing Data</h1>
                <p className="text-sm text-slate-500">Manage and track your marketing leads</p>
            </div>

            {/* View toggle */}
            <div className="flex items-center space-x-2 bg-white p-1 rounded-xl w-fit border border-slate-200 mb-6">
                <button
                    onClick={() => setView("leads")}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        view === "leads"
                            ? "bg-slate-900 text-white shadow"
                            : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Marketing Leads Data
                </button>
                <button
                    onClick={() => setView("interview")}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        view === "interview"
                            ? "bg-slate-900 text-white shadow"
                            : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                    <CalendarClock className="w-4 h-4" />
                    Interview &amp; Screening
                </button>
            </div>

            {view === "leads" ? (
                <MarketingClient restrictToUser={true} />
            ) : (
                <InterviewScreeningClient />
            )}
        </div>
    );
}
