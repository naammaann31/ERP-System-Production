"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
    Search,
    Upload,
    CalendarClock,
    PhoneCall,
    Download,
    AlertCircle,
    Plus,
    X,
    Check,
    ChevronDown,
    Trash2,
} from "lucide-react";
import * as xlsx from "xlsx";
import { Card } from "@/components/ui/card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { compareDatesDesc } from "@/lib/dateSort";
import { toast } from "sonner";

type Section = "interview" | "screening";

// A unified shape so both sections render through the same table code.
interface Row {
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

const normalize = (val: any) => String(val || "").toLowerCase().replace(/[\s\-_]/g, "");

/** Remarks cell: dropdown of values already in use, plus free text. */
function RemarkCell({
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

export default function InterviewScreeningClient() {
    const { profile } = useAuth();
    const [localEntries, setLocalEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Delete confirmation
    const [rowToDelete, setRowToDelete] = useState<Row | null>(null);

    // Excel import
    const [importing, setImporting] = useState(false);
    const [importSummary, setImportSummary] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Set when a file turns out to be one unlabelled table, so we cannot tell
    // from the file itself which of the two tables it belongs in.
    const [sectionPrompt, setSectionPrompt] = useState<
        { rows: any[]; guess: Section; fileName: string } | null
    >(null);

    // Add Data modal
    const [addOpen, setAddOpen] = useState(false);
    const [addSaving, setAddSaving] = useState(false);
    const [form, setForm] = useState({
        section: "screening" as Section,
        date: new Date().toISOString().split("T")[0],
        candidate: "",
        client: "",
        stage: "",
        recruiter: "",
        remarks: "",
    });

    /**
     * Ensures we have a live session before touching Supabase.
     *
     * getUser() validates against the auth server and transparently refreshes
     * an expired access token, so this usually self-heals. Without it, an
     * expired session silently downgrades requests to the `anon` role: reads
     * return zero rows with no error and writes fail with a bare
     * "violates row-level security policy", which points nowhere useful.
     */
    const requireSession = async (supabase: ReturnType<typeof createClient>) => {
        const { data, error: authErr } = await supabase.auth.getUser();
        if (authErr || !data?.user) {
            toast.error("Your session has expired. Please refresh the page and sign in again.");
            return null;
        }
        return data.user;
    };

    const loadData = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error: err } = await supabase
            .from("interview_screening_entries")
            .select("*")
            // Descending so that rows sharing a date show the most recently
            // added first, once buildRows' stable sort runs over them.
            .order("created_at", { ascending: false });

        if (err) {
            console.error("Load failed:", err.message, err);
            setError("Could not load Interview & Screening records.");
        } else {
            setError(null);
        }
        setLocalEntries(data || []);
        setLoading(false);
    };

    useEffect(() => {
        loadData();

        // Live-sync so records added/edited/removed by anyone appear without
        // a manual page refresh.
        const supabase = createClient();
        const channel = supabase
            .channel(`interview_screening_live_${Math.random().toString(36).slice(2)}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "interview_screening_entries" },
                () => loadData()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const buildRows = (section: Section): Row[] =>
        localEntries
            .filter((e) => e.section === section)
            .map((e) => ({
                key: e.id,
                sig: e.id,
                date: e.entry_date || "",
                candidate: e.candidate || "",
                client: e.client || "",
                stage: e.stage || "",
                recruiter: e.recruiter || "",
                remarks: e.remarks || "",
                createdBy: e.created_by ?? null,
            }))
            // Most recent first. entry_date is yearless text ("Apr-30"), so
            // this goes through dateSortKey rather than new Date(); sort is
            // stable, so rows sharing a date keep the created_at order the
            // query returned them in.
            .sort((a, b) => compareDatesDesc(a.date, b.date));

    const allInterviewRows = useMemo(() => buildRows("interview"), [localEntries]);
    const allScreeningRows = useMemo(() => buildRows("screening"), [localEntries]);

    const applySearch = (rows: Row[]) => {
        if (!searchQuery) return rows;
        const q = normalize(searchQuery);
        return rows.filter(
            (r) =>
                normalize(r.date).includes(q) ||
                normalize(r.candidate).includes(q) ||
                normalize(r.client).includes(q) ||
                normalize(r.stage).includes(q) ||
                normalize(r.recruiter).includes(q) ||
                normalize(r.remarks).includes(q)
        );
    };

    const filteredInterviews = useMemo(() => applySearch(allInterviewRows), [allInterviewRows, searchQuery]);
    const filteredScreenings = useMemo(() => applySearch(allScreeningRows), [allScreeningRows, searchQuery]);

    // Dropdown options = every distinct remark currently in use.
    const remarkOptions = useMemo(() => {
        const set = new Map<string, string>();
        [...allInterviewRows, ...allScreeningRows].forEach((r) => {
            const v = r.remarks.trim();
            if (v) set.set(v.toLowerCase(), v);
        });
        return [...set.values()].sort((a, b) => a.localeCompare(b));
    }, [allInterviewRows, allScreeningRows]);

    const handleSaveRemark = async (row: Row, value: string) => {
        const supabase = createClient();
        if (!(await requireSession(supabase))) return;

        const { error: err } = await supabase
            .from("interview_screening_entries")
            .update({ remarks: value })
            .eq("id", row.sig);

        if (err) {
            console.error("Save remark failed:", err.message, err);
            toast.error(err.message || "Could not save remark.");
            return;
        }
        setLocalEntries((prev) => prev.map((e) => (e.id === row.sig ? { ...e, remarks: value } : e)));
        toast.success("Remark updated.");
    };

    const handleDeleteConfirmed = async () => {
        if (!rowToDelete) return;
        const id = rowToDelete.sig;

        const supabase = createClient();
        if (!(await requireSession(supabase))) {
            setRowToDelete(null);
            return;
        }

        // .select() so we can tell a real delete from an RLS-filtered no-op:
        // Supabase returns success with zero rows when a policy blocks the
        // delete, which would otherwise look like it worked.
        const { data: deleted, error: err } = await supabase
            .from("interview_screening_entries")
            .delete()
            .eq("id", id)
            .select();

        if (err) {
            console.error("Delete entry failed:", err.message, err);
            toast.error(err.message || "Could not delete entry.");
            setRowToDelete(null);
            return;
        }

        if (!deleted || deleted.length === 0) {
            toast.error("You can only delete entries you added.");
            setRowToDelete(null);
            return;
        }

        setLocalEntries((prev) => prev.filter((e) => e.id !== id));
        toast.success("Entry deleted.");
        setRowToDelete(null);
    };

    /** Mirrors the RLS delete policy so the UI only offers what will succeed. */
    const canDelete = (row: Row) => {
        const isAdminOrHR = ["Admin", "HR", "OPS_HR"].includes(profile?.role || "");
        return isAdminOrHR || (!!profile?.uid && row.createdBy === profile.uid);
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.candidate.trim()) {
            toast.error("Candidate name is required.");
            return;
        }
        setAddSaving(true);

        const supabase = createClient();
        if (!(await requireSession(supabase))) {
            setAddSaving(false);
            return;
        }
        // created_by is deliberately NOT sent — a BEFORE INSERT trigger stamps
        // it from the authenticated session. Sending it from the client broke
        // for non-Admin users whenever the profile hadn't loaded yet, and it
        // would be spoofable besides.
        const { data, error: err } = await supabase
            .from("interview_screening_entries")
            .insert({
                section: form.section,
                entry_date: form.date.trim(),
                candidate: form.candidate.trim(),
                client: form.client.trim(),
                stage: form.stage.trim(),
                recruiter: form.recruiter.trim(),
                remarks: form.remarks.trim(),
                created_by_name: profile?.fullName || null,
            })
            .select()
            .single();

        setAddSaving(false);

        if (err) {
            console.error("Add entry failed:", err.message, err);
            toast.error(err.message || "Could not save entry.");
            return;
        }

        setLocalEntries((prev) => [data, ...prev]);
        toast.success("Entry added.");
        setAddOpen(false);
        setForm({ section: form.section, date: "", candidate: "", client: "", stage: "", recruiter: "", remarks: "" });
    };

    const handleImportClick = () => fileInputRef.current?.click();

    /**
     * Writes parsed rows and reports what landed where. Shared by the normal
     * path and by the section prompt, so both report identically.
     */
    const commitImport = async (rows: any[], invalid: number) => {
        const supabase = createClient();
        if (!(await requireSession(supabase))) return;

        const { data: inserted, error: err } = await supabase
            .from("interview_screening_entries")
            .insert(rows)
            .select();

        if (err) {
            console.error("Import failed:", err.message, err);
            toast.error(err.message || "Could not import entries.");
            return;
        }

        setLocalEntries((prev) => [...(inserted || []), ...prev]);
        const iCount = rows.filter((p) => p.section === "interview").length;
        const sCount = rows.length - iCount;
        setImportSummary(
            `Import Complete!\n\nInterview rows imported: ${iCount}\nScreening rows imported: ${sCount}\nSkipped (no candidate name): ${invalid}`
        );
        toast.success(`Imported ${rows.length} row(s).`);
    };

    /**
     * Imports Interview / Screening rows from Excel into Supabase.
     *
     * Accepts three shapes:
     *  1. A workbook with sheets named "Interview" and/or "Screening" —
     *     i.e. exactly what this page's Export XL produces, so an
     *     export → edit → import round trip works.
     *  2. A single sheet laid out like the source Google Sheet, with the
     *     two tables side by side under an "Interview"/"Screening" group
     *     header row. Each block is located by its own Date+Candidate header
     *     pair rather than assumed to start at a fixed column.
     *  3. One bare 6-column table (Date, Candidate, Client, Stage/Method,
     *     Recruiter, Remarks) with no headers at all — what you get when a
     *     single table is copied out of the sheet on its own. Nothing in the
     *     file says which of the two tables it is, so the user is asked.
     */
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileName = file.name;
        setImporting(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const workbook = xlsx.read(evt.target?.result, { type: "binary" });
                const pick = (row: any, keys: string[]) => {
                    for (const k of keys) {
                        const hit = Object.keys(row).find((c) => c.trim().toLowerCase() === k.toLowerCase());
                        if (hit && String(row[hit] ?? "").trim() !== "") return row[hit];
                    }
                    return "";
                };

                /**
                 * Dates are taken as the cell's DISPLAYED text, never its
                 * underlying value.
                 *
                 * In the real exports the two disagree: a cell showing
                 * "May-01" stores 2001-04-30, because whatever produced the
                 * file read the sheet's "May 1" as May *2001*. The displayed
                 * text is the only surviving record of the intended date, and
                 * it also matches how rows pulled from the Google Sheet are
                 * already stored (entry_date is free text). So no year is
                 * invented and no serial-number conversion is needed —
                 * `raw: false` below hands us the formatted string directly.
                 */
                const text = (v: any) => String(v ?? "").trim();

                const pending: any[] = [];
                let invalid = 0;

                const pushRow = (section: Section, r: any) => {
                    const candidate = text(pick(r, ["Candidate", "Candidate Name", "Name"]));
                    if (!candidate) { invalid++; return; }
                    pending.push({
                        section,
                        entry_date: text(pick(r, ["Date"])),
                        candidate,
                        client: text(pick(r, ["Client", "Company", "Company Name"])),
                        stage:
                            section === "interview"
                                ? text(pick(r, ["Stage (No of Round)", "Stage(No of Round)", "Stage", "Round"]))
                                : text(pick(r, ["Screening/AI", "Screening / AI", "Screening", "Method"])),
                        recruiter: text(pick(r, ["Recruiter"])),
                        remarks: text(pick(r, ["Remarks", "Remark"])),
                        created_by_name: profile?.fullName || null,
                    });
                };

                const named = workbook.SheetNames.filter((n) =>
                    ["interview", "screening"].includes(n.trim().toLowerCase())
                );

                if (named.length > 0) {
                    // Shape 1: separate named sheets
                    for (const name of named) {
                        const section: Section =
                            name.trim().toLowerCase() === "interview" ? "interview" : "screening";
                        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[name], {
                            defval: "", raw: false,
                        });
                        (rows as any[]).forEach((r) => pushRow(section, r));
                    }
                } else {
                    const ws = workbook.Sheets[workbook.SheetNames[0]];
                    // raw: false yields each cell's displayed text — see the
                    // note on `text` above for why that matters for dates.
                    const grid = xlsx.utils.sheet_to_json<any[]>(ws, {
                        header: 1, defval: "", blankrows: true, raw: false,
                    });
                    const cell = (row: any[], i: number) => row?.[i] ?? "";
                    const norm = (v: any) => String(v ?? "").trim().toLowerCase();

                    const headerRow = grid.findIndex((r) =>
                        (r || []).some((c) => norm(c) === "candidate")
                    );

                    // Each block starts at its own Date+Candidate header pair.
                    // Locating them beats assuming fixed columns 0 and 6: a
                    // spacer or extra leading column would otherwise shift every
                    // field silently (client into stage, stage into recruiter).
                    const blocks: { section: Section; base: number }[] = [];

                    if (headerRow !== -1) {
                        const header = grid[headerRow] || [];
                        // The group header row above carries "Interview" /
                        // "Screening"; merged cells put the label on the
                        // block's first column, so scan leftwards for it.
                        const groupRow = headerRow > 0 ? grid[headerRow - 1] || [] : [];

                        header.forEach((h: any, i: number) => {
                            if (norm(h) !== "date") return;
                            if (norm(header[i + 1]) !== "candidate") return;
                            let section: Section | null = null;
                            for (let c = i; c >= 0 && section === null; c--) {
                                const g = norm(groupRow[c]);
                                if (g.includes("interview")) section = "interview";
                                else if (g.includes("screening")) section = "screening";
                            }
                            // Fall back on the block's own 4th column, which is
                            // "Stage (No of Round)" vs "Screening/AI".
                            if (section === null) {
                                section = norm(header[i + 3]).includes("screening") ? "screening" : "interview";
                            }
                            blocks.push({ section, base: i });
                        });
                    }

                    const readBlocks = (from: number, into: { section: Section; base: number }[]) => {
                        for (let i = from; i < grid.length; i++) {
                            const row = grid[i] || [];
                            for (const { section, base } of into) {
                                const span = [0, 1, 2, 3, 4, 5].map((o) => base + o);
                                // Blocks pad each other with blanks when one
                                // table is longer, so skip a block that is
                                // empty on this row.
                                if (!span.some((c) => String(cell(row, c)).trim() !== "")) continue;
                                pushRow(section, {
                                    Date: cell(row, base),
                                    Candidate: cell(row, base + 1),
                                    Client: cell(row, base + 2),
                                    [section === "interview" ? "Stage" : "Screening"]: cell(row, base + 3),
                                    Recruiter: cell(row, base + 4),
                                    Remarks: cell(row, base + 5),
                                });
                            }
                        }
                    };

                    if (blocks.length > 0) {
                        // Shape 2: labelled, one or both tables present.
                        readBlocks(headerRow + 1, blocks);
                    } else {
                        // Shape 3: a bare table with no headers whatsoever, so
                        // the file cannot say which section it is. Parse it
                        // into staged rows and let the user pick.
                        const staged: any[] = [];
                        const sink = pending.length;
                        readBlocks(0, [{ section: "screening", base: 0 }]);
                        staged.push(...pending.splice(sink));

                        if (staged.length === 0) {
                            toast.error("No valid rows found. Each row needs at least a Candidate name.");
                            return;
                        }

                        // The filename is the only hint available, so it seeds
                        // the default choice rather than deciding silently.
                        const guess: Section = /interview/i.test(fileName) ? "interview" : "screening";
                        setSectionPrompt({ rows: staged, guess, fileName });
                        return;
                    }
                }

                if (pending.length === 0) {
                    toast.error("No valid rows found. Each row needs at least a Candidate name.");
                    return;
                }

                await commitImport(pending, invalid);
            } catch (error) {
                console.error("Error during import:", error);
                toast.error("Failed to import file. Please check the format.");
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleExport = () => {
        const workbook = xlsx.utils.book_new();
        const toSheet = (rows: Row[], stageLabel: string) =>
            xlsx.utils.json_to_sheet(
                rows.map((r) => ({
                    Date: r.date,
                    Candidate: r.candidate,
                    Client: r.client,
                    [stageLabel]: r.stage,
                    Recruiter: r.recruiter,
                    Remarks: r.remarks,
                }))
            );
        xlsx.utils.book_append_sheet(workbook, toSheet(filteredInterviews, "Stage (No of Round)"), "Interview");
        xlsx.utils.book_append_sheet(workbook, toSheet(filteredScreenings, "Screening/AI"), "Screening");
        xlsx.writeFile(workbook, `interview_screening_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm text-slate-500 font-medium">Loading sheet data...</span>
            </div>
        );
    }

    const renderTable = (rows: Row[], stageLabel: string) => (
        <div className="overflow-x-auto w-full max-w-full">
<table className="w-full text-sm text-left relative">
            <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Date</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Candidate</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Client</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">{stageLabel}</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Recruiter</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Remarks</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                            No records found.
                        </td>
                    </tr>
                ) : (
                    rows.map((row, index) => (
                        <tr
                            key={row.key}
                            className={`hover:bg-slate-100 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                        >
                            <td className="px-6 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">{row.date || "-"}</td>
                            <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap capitalize">
                                {row.candidate || "-"}
                            </td>
                            <td className="px-6 py-4 text-slate-700">{row.client || "-"}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap capitalize">{row.stage || "-"}</td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap capitalize">{row.recruiter || "-"}</td>
                            <td className="px-6 py-4">
                                <RemarkCell row={row} options={remarkOptions} onSave={handleSaveRemark} />
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                {canDelete(row) ? (
                                    <button
                                        onClick={() => setRowToDelete(row)}
                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                        title="Delete this entry"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <span
                                        className="text-slate-300 text-xs"
                                        title="Only the person who added this entry (or Admin/HR) can delete it"
                                    >
                                        —
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
</div>
    );

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search candidates, clients..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setAddOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-semibold text-sm rounded-xl transition-all shadow-sm whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        Add Data
                    </button>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={handleImportClick}
                        disabled={importing}
                        className={`flex items-center gap-2 px-4 py-2.5 ${importing ? "bg-blue-50 text-blue-400" : "bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"} font-semibold text-sm rounded-xl transition-all border border-blue-200 shadow-sm whitespace-nowrap`}
                        title="Import from Excel"
                    >
                        <Download className={`w-4 h-4 ${importing ? "animate-bounce" : ""}`} />
                        {importing ? "Importing..." : "Import XL"}
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-semibold text-sm rounded-xl transition-all border border-emerald-200 shadow-sm whitespace-nowrap"
                        title="Export as Excel"
                    >
                        <Upload className="w-4 h-4" />
                        Export XL
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Interview Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
                    <div className="px-6 py-5 border-b border-slate-100 bg-blue-50/50">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <CalendarClock className="h-5 w-5 text-blue-500" />
                            Interview
                            <span className="bg-blue-200 text-blue-800 text-xs py-0.5 px-2.5 rounded-full font-semibold">
                                {filteredInterviews.length}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Scheduled and completed candidate interviews.</p>
                    </div>
                    <div className="overflow-auto max-h-[520px] custom-scrollbar">{renderTable(filteredInterviews, "Stage")}</div>
                </Card>
            </motion.div>

            {/* Screening Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
                <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
                    <div className="px-6 py-5 border-b border-slate-100 bg-indigo-50/50">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <PhoneCall className="h-5 w-5 text-indigo-500" />
                            Screening
                            <span className="bg-indigo-200 text-indigo-800 text-xs py-0.5 px-2.5 rounded-full font-semibold">
                                {filteredScreenings.length}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Initial screening calls and intro meetings with clients.</p>
                    </div>
                    <div className="overflow-auto max-h-[600px] custom-scrollbar">{renderTable(filteredScreenings, "Screening/AI")}</div>
                </Card>
            </motion.div>

            <ConfirmModal
                isOpen={!!importSummary}
                onClose={() => setImportSummary(null)}
                onConfirm={() => setImportSummary(null)}
                title="Import Summary"
                description={
                    <div className="whitespace-pre-line font-mono text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {importSummary}
                    </div>
                }
                confirmText="OK"
                cancelText="Close"
                variant="success"
            />

            {/* Section picker — shown only when the file is one bare table
                with no Interview/Screening headers to route it by. */}
            {sectionPrompt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
                    >
                        <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Which table?</h2>
                            <p className="text-xs font-semibold text-slate-500 mt-1">
                                <span className="font-mono">{sectionPrompt.fileName}</span> has no
                                Interview/Screening headers, so it can&apos;t be routed automatically.
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">
                                Put all <span className="font-bold">{sectionPrompt.rows.length}</span> rows into:
                            </p>
                            <div className="flex gap-3">
                                {(["interview", "screening"] as Section[]).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            const rows = sectionPrompt.rows.map((r) => ({ ...r, section: s }));
                                            setSectionPrompt(null);
                                            commitImport(rows, 0);
                                        }}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all capitalize ${
                                            sectionPrompt.guess === s
                                                ? "bg-slate-900 text-white shadow-md hover:bg-slate-800"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setSectionPrompt(null)}
                                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!rowToDelete}
                onClose={() => setRowToDelete(null)}
                onConfirm={handleDeleteConfirmed}
                title="Delete Entry"
                description={`Are you sure you want to delete "${rowToDelete?.candidate || "this entry"}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />

            {/* Add Data Modal */}
            {addOpen && (
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
                                onClick={() => setAddOpen(false)}
                                className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="p-6 space-y-5">
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
                                    disabled={addSaving}
                                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-md"
                                >
                                    {addSaving ? "Saving..." : "Save entry"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddOpen(false)}
                                    className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
