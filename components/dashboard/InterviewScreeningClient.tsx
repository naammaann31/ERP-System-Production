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
    Pencil,
} from "lucide-react";
import * as xlsx from "xlsx";
import { Card } from "@/components/ui/card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { createClient } from "@/lib/supabase/client";
import { requireSession } from "@/lib/supabase/requireSession";
import { useAuth } from "@/components/providers/AuthProvider";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { parseInterviewScreeningWorkbook, Section } from "@/lib/interviewScreeningExcelImport";
import RemarkCell, { Row } from "@/components/dashboard/interviewScreening/RemarkCell";
import AddEntryModal, { AddEntryForm } from "@/components/dashboard/interviewScreening/AddEntryModal";
import EditEntryModal, { EditEntryForm } from "@/components/dashboard/interviewScreening/EditEntryModal";
import SectionChoiceModal from "@/components/dashboard/interviewScreening/SectionChoiceModal";
import { isMarketingTeamLead } from "@/lib/marketingTeamLeadAccess";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

// ── Helpers (local to this file — intentionally not shared with
//    MarketingClient.tsx, which must not be touched by this change) ──────────

/**
 * Escape special PostgreSQL ILIKE characters in user-typed input so that
 * literal `%`, `_`, and `\` are treated as plain text rather than wildcards.
 * Also strips commas which are PostgREST .or() filter delimiters.
 */
function escapeLike(str: string): string {
    return str
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_")
        .replace(/,/g, "");
}

/**
 * Build an ILIKE pattern that ignores differences in spacing/hyphens/
 * underscores between words (e.g. "brain co" should match "Brain Co",
 * "BrainCo", and "Brain-Co" alike). Each run of separator characters in the
 * query becomes a `%` wildcard instead of being deleted, so it matches
 * regardless of whatever separator — or none — sits there in the stored
 * value. Backslashes/percent signs are escaped first so they aren't
 * mistaken for SQL wildcards, and commas are stripped since they delimit
 * PostgREST's `.or()` filter groups.
 */
function buildSearchPattern(str: string): string {
    const escaped = str
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/,/g, "")
        .replace(/[\s\-_]+/g, "%");
    return `%${escaped}%`;
}

const toRow = (e: any): Row => ({
    key: e.id,
    sig: e.id,
    date: e.entry_date || "",
    candidate: e.candidate || "",
    client: e.client || "",
    stage: e.stage || "",
    recruiter: e.recruiter || "",
    remarks: e.remarks || "",
    createdBy: e.created_by ?? null,
});

export default function InterviewScreeningClient() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // ── Per-section paginated state ─────────────────────────────────────────
    const [interviewData, setInterviewData] = useState<any[]>([]);
    const [interviewOffset, setInterviewOffset] = useState(0);
    const [interviewTotalCount, setInterviewTotalCount] = useState(0);
    const [interviewLoadingMore, setInterviewLoadingMore] = useState(false);

    const [screeningData, setScreeningData] = useState<any[]>([]);
    const [screeningOffset, setScreeningOffset] = useState(0);
    const [screeningTotalCount, setScreeningTotalCount] = useState(0);
    const [screeningLoadingMore, setScreeningLoadingMore] = useState(false);

    // Always reflects the latest debounced search term, read by the
    // long-lived realtime handler below so it never queries with a stale
    // (captured-at-subscribe-time) search value.
    const searchRef = useRef("");

    // Admin or Marketing Team Lead (including the T&D Manager override) get
    // full edit + delete rights on every row; mirrors the DB-level
    // enforcement in migration 00000000000021 — this only controls what the
    // UI offers, the trigger/policy is what actually protects the data.
    const canManage = profile?.role === "Admin" || isMarketingTeamLead(profile);

    // Delete confirmation
    const [rowToDelete, setRowToDelete] = useState<Row | null>(null);

    // Edit modal (Admin / Marketing Team Lead only)
    const [editingRow, setEditingRow] = useState<{ row: Row; section: Section } | null>(null);
    const [editForm, setEditForm] = useState<EditEntryForm>({
        date: "",
        candidate: "",
        client: "",
        stage: "",
        recruiter: "",
        remarks: "",
    });
    const [editSaving, setEditSaving] = useState(false);

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

    // ── Debounce search input (400 ms) ──────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // ── Query builder — section-scoped, search-filtered, no .range() yet ───
    // No ownership filter here by design: every marketing employee is meant
    // to see every Interview/Screening row (shared team resource), unchanged
    // from how this table has always worked.
    //
    // Ordered by entry_date_sort (a trigger-maintained column — see the
    // 00000000000019 migration — that parses the free-text entry_date into
    // a real comparable number) so the most recent date is always first,
    // with created_at as the tie-breaker for rows sharing the same date.
    // nullsFirst:false sinks unparseable/empty dates to the bottom instead
    // of letting them float to the top.
    const buildQuery = (supabase: ReturnType<typeof createClient>, section: Section) => {
        let query = supabase
            .from("interview_screening_entries")
            .select("*", { count: "exact" })
            .eq("section", section)
            .order("entry_date_sort", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });

        const search = searchRef.current;
        if (search) {
            const pattern = buildSearchPattern(escapeLike(search.toLowerCase()));
            query = query.or(
                `entry_date.ilike.${pattern},candidate.ilike.${pattern},client.ilike.${pattern},stage.ilike.${pattern},recruiter.ilike.${pattern},remarks.ilike.${pattern}`
            );
        }
        return query;
    };

    /**
     * Fetches one page of one section. `append: false` replaces that
     * section's loaded rows (used for the initial load, a search change, and
     * a realtime-triggered refresh); `append: true` adds the next page (used
     * by that section's "Load More" button).
     */
    const fetchPage = async (section: Section, offsetVal: number, append: boolean) => {
        const supabase = createClient();
        const { data, count, error: err } = await buildQuery(supabase, section).range(
            offsetVal,
            offsetVal + PAGE_SIZE - 1
        );

        if (err) {
            console.error(`Load ${section} failed:`, err.message, err);
            setError("Could not load Interview & Screening records.");
            return;
        }
        setError(null);

        const rows = data || [];
        const setData = section === "interview" ? setInterviewData : setScreeningData;
        const setOffset = section === "interview" ? setInterviewOffset : setScreeningOffset;
        const setTotal = section === "interview" ? setInterviewTotalCount : setScreeningTotalCount;

        setData((prev) => (append ? [...prev, ...rows] : rows));
        setOffset(offsetVal + PAGE_SIZE);
        setTotal(count ?? 0);
    };

    // ── Initial load + reload on search change ──────────────────────────────
    useEffect(() => {
        searchRef.current = debouncedSearch;
        Promise.all([
            fetchPage("interview", 0, false),
            fetchPage("screening", 0, false),
        ]).finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    // ── Realtime: refresh only the section the change actually affects ─────
    // (Option 2 — a targeted refresh, not a blanket "any change → reload
    // everything.") Uses a fixed channel name so repeated mounts don't pile
    // up duplicate subscriptions.
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel("interview_screening_live")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "interview_screening_entries" },
                (payload) => {
                    const row = (payload.new ?? payload.old) as any;
                    const section: Section = row?.section === "interview" ? "interview" : "screening";
                    fetchPage(section, 0, false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const interviewRows = useMemo(() => interviewData.map(toRow), [interviewData]);
    const screeningRows = useMemo(() => screeningData.map(toRow), [screeningData]);

    // Dropdown options = every distinct remark among currently loaded rows.
    const remarkOptions = useMemo(() => {
        const set = new Map<string, string>();
        [...interviewRows, ...screeningRows].forEach((r) => {
            const v = r.remarks.trim();
            if (v) set.set(v.toLowerCase(), v);
        });
        return [...set.values()].sort((a, b) => a.localeCompare(b));
    }, [interviewRows, screeningRows]);

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
        // Only one of these will actually contain the row; the other is a
        // harmless no-op, which avoids needing to track section on Row.
        setInterviewData((prev) => prev.map((e) => (e.id === row.sig ? { ...e, remarks: value } : e)));
        setScreeningData((prev) => prev.map((e) => (e.id === row.sig ? { ...e, remarks: value } : e)));
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
            toast.error("Only Admin or the Marketing Team Lead can delete entries.");
            setRowToDelete(null);
            return;
        }

        const wasInterview = interviewData.some((e) => e.id === id);
        setInterviewData((prev) => prev.filter((e) => e.id !== id));
        setScreeningData((prev) => prev.filter((e) => e.id !== id));
        if (wasInterview) {
            setInterviewTotalCount((prev) => Math.max(0, prev - 1));
        } else {
            setScreeningTotalCount((prev) => Math.max(0, prev - 1));
        }

        toast.success("Entry deleted.");
        setRowToDelete(null);
    };

    const openEdit = (row: Row, section: Section) => {
        setEditingRow({ row, section });
        setEditForm({
            date: row.date,
            candidate: row.candidate,
            client: row.client,
            stage: row.stage,
            recruiter: row.recruiter,
            remarks: row.remarks,
        });
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRow) return;
        if (!editForm.candidate.trim()) {
            toast.error("Candidate name is required.");
            return;
        }
        setEditSaving(true);

        const supabase = createClient();
        if (!(await requireSession(supabase))) {
            setEditSaving(false);
            return;
        }

        const { data, error: err } = await supabase
            .from("interview_screening_entries")
            .update({
                entry_date: editForm.date.trim(),
                candidate: editForm.candidate.trim(),
                client: editForm.client.trim(),
                stage: editForm.stage.trim(),
                recruiter: editForm.recruiter.trim(),
                remarks: editForm.remarks.trim(),
            })
            .eq("id", editingRow.row.sig)
            .select()
            .single();

        setEditSaving(false);

        if (err) {
            console.error("Edit entry failed:", err.message, err);
            toast.error(err.message || "Could not save changes.");
            return;
        }

        const setData = editingRow.section === "interview" ? setInterviewData : setScreeningData;
        setData((prev) => prev.map((r) => (r.id === data.id ? data : r)));

        toast.success("Entry updated.");
        setEditingRow(null);
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

        if (data.section === "interview") {
            setInterviewData((prev) => [data, ...prev]);
            setInterviewTotalCount((prev) => prev + 1);
        } else {
            setScreeningData((prev) => [data, ...prev]);
            setScreeningTotalCount((prev) => prev + 1);
        }

        toast.success("Entry added.");
        setAddOpen(false);
        setForm({ section: form.section, date: "", candidate: "", client: "", stage: "", recruiter: "", remarks: "" });
    };

    const handleImportClick = () => fileInputRef.current?.click();

    /**
     * Writes parsed rows and reports what landed where. Shared by the normal
     * path and by the section prompt, so both report identically. Rows are
     * prepended into whichever section(s) they belong to, same as the
     * existing optimistic-update convention elsewhere in this app — the
     * loaded list is allowed to temporarily exceed one page's size right
     * after an import/add, which is exactly what makes a just-imported batch
     * immediately visible without needing a reload.
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

        const insertedInterview = (inserted || []).filter((r) => r.section === "interview");
        const insertedScreening = (inserted || []).filter((r) => r.section === "screening");

        if (insertedInterview.length > 0) {
            setInterviewData((prev) => [...insertedInterview, ...prev]);
            setInterviewTotalCount((prev) => prev + insertedInterview.length);
        }
        if (insertedScreening.length > 0) {
            setScreeningData((prev) => [...insertedScreening, ...prev]);
            setScreeningTotalCount((prev) => prev + insertedScreening.length);
        }

        const iCount = insertedInterview.length;
        const sCount = insertedScreening.length;
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

    // Makes its own full (unpaginated) query per section, with the same
    // active search filter, so the export always contains every matching
    // row — not just whatever happens to be loaded on screen.
    const handleExport = async () => {
        try {
            toast.info("Preparing export...");
            const supabase = createClient();
            const [{ data: iData, error: iErr }, { data: sData, error: sErr }] = await Promise.all([
                buildQuery(supabase, "interview"),
                buildQuery(supabase, "screening"),
            ]);
            if (iErr) throw iErr;
            if (sErr) throw sErr;

            const toSheet = (rows: any[], stageLabel: string) =>
                xlsx.utils.json_to_sheet(
                    rows.map(toRow).map((r) => ({
                        Date: r.date,
                        Candidate: r.candidate,
                        Client: r.client,
                        [stageLabel]: r.stage,
                        Recruiter: r.recruiter,
                        Remarks: r.remarks,
                    }))
                );

            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, toSheet(iData || [], "Stage (No of Round)"), "Interview");
            xlsx.utils.book_append_sheet(workbook, toSheet(sData || [], "Screening/AI"), "Screening");
            xlsx.writeFile(workbook, `interview_screening_${new Date().toISOString().split("T")[0]}.xlsx`);
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Export failed. Please try again.");
        }
    };

    if (loading) {
        return <LoadingSpinner label="Loading sheet data..." />;
    }

    const renderTable = (rows: Row[], stageLabel: string, section: Section) => (
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
                    {canManage && <th className="px-6 py-4 font-semibold whitespace-nowrap text-right">Actions</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={canManage ? 7 : 6} className="px-6 py-12 text-center text-slate-500">
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
                            {canManage && (
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => openEdit(row, section)}
                                            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                                            title="Edit entry"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setRowToDelete(row)}
                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                            title="Delete entry"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            )}
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
                                {interviewRows.length.toLocaleString()} of {interviewTotalCount.toLocaleString()}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Scheduled and completed candidate interviews.</p>
                    </div>
                    <div className="overflow-auto max-h-[520px] custom-scrollbar">
                        {renderTable(interviewRows, "Stage", "interview")}
                        {interviewData.length < interviewTotalCount && (
                            <div className="py-5 flex justify-center border-t border-slate-100">
                                <button
                                    onClick={async () => {
                                        setInterviewLoadingMore(true);
                                        await fetchPage("interview", interviewOffset, true);
                                        setInterviewLoadingMore(false);
                                    }}
                                    disabled={interviewLoadingMore}
                                    className="px-6 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-semibold text-sm rounded-xl transition-all border border-blue-100 shadow-sm disabled:opacity-60"
                                >
                                    {interviewLoadingMore
                                        ? "Loading..."
                                        : `Load More (${(interviewTotalCount - interviewData.length).toLocaleString()} remaining)`}
                                </button>
                            </div>
                        )}
                    </div>
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
                                {screeningRows.length.toLocaleString()} of {screeningTotalCount.toLocaleString()}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Initial screening calls and intro meetings with clients.</p>
                    </div>
                    <div className="overflow-auto max-h-[600px] custom-scrollbar">
                        {renderTable(screeningRows, "Screening/AI", "screening")}
                        {screeningData.length < screeningTotalCount && (
                            <div className="py-5 flex justify-center border-t border-slate-100">
                                <button
                                    onClick={async () => {
                                        setScreeningLoadingMore(true);
                                        await fetchPage("screening", screeningOffset, true);
                                        setScreeningLoadingMore(false);
                                    }}
                                    disabled={screeningLoadingMore}
                                    className="px-6 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 font-semibold text-sm rounded-xl transition-all border border-indigo-100 shadow-sm disabled:opacity-60"
                                >
                                    {screeningLoadingMore
                                        ? "Loading..."
                                        : `Load More (${(screeningTotalCount - screeningData.length).toLocaleString()} remaining)`}
                                </button>
                            </div>
                        )}
                    </div>
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

            {/* Edit Entry Modal (Admin / Marketing Team Lead only) */}
            {editingRow && (
                <EditEntryModal
                    sectionLabel={editingRow.section === "interview" ? "Interview" : "Screening"}
                    form={editForm}
                    setForm={setEditForm}
                    remarkOptions={remarkOptions}
                    saving={editSaving}
                    onSubmit={handleEditSubmit}
                    onClose={() => setEditingRow(null)}
                />
            )}
        </div>
    );
}
