"use client";

import React from "react";
import CandidatesClient from "@/components/dashboard/CandidatesClient";

export default function CandidatesPage() {
    return (
        <div className="h-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Candidates</h1>
                <p className="text-sm text-slate-500">Track candidates and who is working on them</p>
            </div>

            <CandidatesClient />
        </div>
    );
}
