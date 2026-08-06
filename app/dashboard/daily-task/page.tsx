import React from "react";

export default function DailyTaskPage() {
    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-800">Marketing Daily Task</h1>
            </div>
            <div className="flex-1 w-full h-full min-h-[600px]">
                <iframe 
                    src="https://docs.google.com/spreadsheets/d/1am7rFQV4dZgdwWqGisZh3zMbgKprfYp64R_uaQ93nVA/edit?gid=2047999258&rm=minimal" 
                    width="100%" 
                    height="100%" 
                    className="w-full h-full border-0"
                    title="Marketing Daily Task Sheet"
                    allowFullScreen
                ></iframe>
            </div>
        </div>
    );
}
