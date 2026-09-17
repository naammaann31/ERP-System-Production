"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, X } from "lucide-react";

// A unified shape so both sections render through the same table code.
export interface Row {
    key: string;
    sig: string;
    date: string;
    candidate: string;
    client: string;
    stage: string; // "Stage" for interview, "Screening/AI" for screening
    recruiter: string;
    remarks: string;
    createdBy?: string | null; // owner, for delete permission
}

const getRemarkColor = (remark: string) => {
    const r = remark.toLowerCase();
    if (!r) return "";
    if (r.includes("reject") || r.includes("cancel") || r.includes("not attend") || r.includes("miss") || r.includes("hold") || r.includes("not join"))
        return "bg-rose-50 text-rose-700 border-rose-200";
    if (r.includes("went well") || r.includes("selected") || r.includes("offer"))
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (r.includes("follow up") || r.includes("pending") || r.includes("reschedule") || r.includes("sharing"))
        return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-50 text-slate-600 border-slate-200";
};

/** Remarks cell: dropdown of values already in use, plus free text. */
export default function RemarkCell({
    row,
    options,
    onSave,
}: {
    row: Row;
    options: string[];
    onSave: (row: Row, value: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [custom, setCustom] = useState("");
    const [saving, setSaving] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [open]);

    const commit = async (value: string) => {
        setOpen(false);
        setCustom("");
        if (value === row.remarks) return;
        setSaving(true);
        await onSave(row, value);
        setSaving(false);
    };

    return (
        <div className="relative min-w-[170px]" ref={ref}>
            <button
                onClick={() => setOpen((o) => !o)}
                disabled={saving}
                className={`inline-flex w-full items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all hover:brightness-95 disabled:opacity-60 ${
                    row.remarks ? getRemarkColor(row.remarks) : "bg-white text-slate-400 border-slate-200 border-dashed"
                }`}
                title="Click to edit remark"
            >
                <span className="truncate text-left">{saving ? "Saving..." : row.remarks || "Add remark"}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </button>

            {open && (
                <div className="absolute z-30 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="max-h-52 overflow-y-auto custom-scrollbar py-1">
                        <button
                            onClick={() => commit("")}
                            className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 flex items-center gap-2"
                        >
                            <X className="h-3 w-3" /> Clear remark
                        </button>
                        {options.map((opt) => (
                            <button
                                key={opt}
                                onClick={() => commit(opt)}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2"
                            >
                                <span className="truncate">{opt}</span>
                                {row.remarks.toLowerCase() === opt.toLowerCase() && (
                                    <Check className="h-3 w-3 text-blue-600 shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="border-t border-slate-100 p-2 bg-slate-50/60">
                        <input
                            autoFocus
                            value={custom}
                            onChange={(e) => setCustom(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && custom.trim()) commit(custom.trim());
                                if (e.key === "Escape") setOpen(false);
                            }}
                            placeholder="Or type a custom remark..."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
