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
    Trash2,
} from "lucide-react";
import * as xlsx from "xlsx";
import { Card } from "@/components/ui/card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { createClient } from "@/lib/supabase/client";
import { requireSession } from "@/lib/supabase/requireSession";
import { useAuth } from "@/components/providers/AuthProvider";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { compareDatesDesc } from "@/lib/dateSort";
import { parseInterviewScreeningWorkbook, Section } from "@/lib/interviewScreeningExcelImport";
import RemarkCell, { Row } from "@/components/dashboard/interviewScreening/RemarkCell";
import AddEntryModal, { AddEntryForm } from "@/components/dashboard/interviewScreening/AddEntryModal";
import SectionChoiceModal from "@/components/dashboard/interviewScreening/SectionChoiceModal";
import { toast } from "sonner";

const normalize = (val: any) => String(val || "").toLowerCase().replace(/[\s\-_]/g, "");

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
    const [form, setForm] = useState<AddEntryForm>({
        section: "screening",
        date: new Date().toISOString().split("T")[0],
        candidate: "",
        client: "",
        stage: "",
        recruiter: "",
        remarks: "",
    });

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
        // created_by is deliberately NOT sent â€” a BEFORE INSERT trigger stamps
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileName = file.name;
        setImporting(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const workbook = xlsx.read(evt.target?.result, { type: "binary" });
                const result = parseInterviewScreeningWorkbook(
                    workbook,
                    fileName,
                    profile?.fullName || null,
                    (staged) => setSectionPrompt(staged)
                );
                if (!result) return;

                await commitImport(result.pending, result.invalid);
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
        return <LoadingSpinner label="Loading sheet data..." />;
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
                    
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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

            {/* Section picker â€” shown only when the file is one bare table
                with no Interview/Screening headers to route it by. */}
            {sectionPrompt && (
                <SectionChoiceModal
                    staged={sectionPrompt}
                    onChoose={(rows) => {
                        setSectionPrompt(null);
                        commitImport(rows, 0);
                    }}
                    onCancel={() => setSectionPrompt(null)}
                />
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
                <AddEntryModal
                    form={form}
                    setForm={setForm}
                    remarkOptions={remarkOptions}
                    saving={addSaving}
                    onSubmit={handleAddSubmit}
                    onClose={() => setAddOpen(false)}
                />
            )}
        </div>
    );
}

