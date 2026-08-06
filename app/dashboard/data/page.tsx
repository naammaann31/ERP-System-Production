"use client";

import React from "react";
import MarketingClient from "@/components/dashboard/MarketingClient";

export default function DataPage() {
    return (
        <div className="h-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Marketing Data</h1>
                <p className="text-sm text-slate-500">Manage and track your marketing leads</p>
            </div>
            
            <MarketingClient restrictToUser={true} />
        </div>
    );
}
