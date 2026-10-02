"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Table as TableIcon, Trash2, Download, Upload, Search, Save } from "lucide-react";
import * as xlsx from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { marketingRowToUi, marketingUiToRow } from "@/lib/salesMarketingMap";
import { parseMarketingWorkbook, formatCanonicalDate, toCanonicalForCompare } from "@/lib/marketingExcelImport";
import { useAuth } from "@/components/providers/AuthProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/card";
import GenerateReportModal from "@/components/dashboard/marketing/GenerateReportModal";
import { isMarketingTeamLead } from "@/lib/marketingTeamLeadAccess";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

// ── Helpers ───────────────────────────────────────────────────────────────────

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
 * Build an ILIKE pattern for the free-text search box that ignores
 * differences in spacing/hyphens/underscores between words — e.g. "brain co"
 * should match "Brain Co", "BrainCo", and "Brain-Co" alike, since that's
 * what the old client-side search (which normalised both the query AND the
 * stored value before comparing) used to do.
 *
 * We can't normalise the stored column server-side without a schema change,
 * so instead each run of separator characters in the query is turned into a
 * `%` wildcard (rather than deleted) so it matches regardless of whatever
 * separator — or none — actually sits there in the stored value. Literal
 * backslashes/percent signs are escaped first so they aren't mistaken for
 * SQL wildcards, and commas are stripped since they delimit PostgREST's
 * `.or()` filter groups.
 */
function buildSearchPattern(str: string): string {
    const escaped = str
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/,/g, "")
        .replace(/[\s\-_]+/g, "%");
    return `%${escaped}%`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MarketingClientProps {
    restrictToUser?: boolean;
    filterByUid?: string;
    filterByName?: string;
}

export default function MarketingClient({
    restrictToUser = false,
    filterByUid,
    filterByName,
}: MarketingClientProps) {
    // ── Data state ─────────────────────────────────────────────────────────
    const [data, setData] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [importing, setImporting] = useState(false);
    const [offset, setOffset] = useState(0);

    // ── Filter state ───────────────────────────────────────────────────────
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // ── Inline Add state ───────────────────────────────────────────────────
    const [isAddingNew, setIsAddingNew] = useState(false);

    const createEmptyRow = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        return {
            id: Math.random().toString(36).substr(2, 9),
            CandidateName: "",
            Date: `${yyyy}-${mm}-${dd}`,
            CompanyName: "",
            Link: "",
        };
    };

    const [newRows, setNewRows] = useState([createEmptyRow()]);
    const [savingRow, setSavingRow] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [importSummary, setImportSummary] = useState<string | null>(null);

    // ── Selection + delete state ───────────────────────────────────────────
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
    const [candidateToDelete, setCandidateToDelete] = useState<any | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { profile } = useAuth();

    // ── Debounce search input (400 ms) ─────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            // Reset pagination whenever the search term changes
            setOffset(0);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset pagination when date filters change
    useEffect(() => {
        setOffset(0);
    }, [startDate, endDate]);

    // ── Core Supabase query builder ─────────────────────────────────────────
    //
    // Returns a query with all filters applied but WITHOUT .range() so it can
    // be reused for both paginated fetches and full exports.
    const buildBaseQuery = useCallback(
        (supabase: ReturnType<typeof createClient>, selectStr: string) => {
            let query = supabase
                .from("marketing")
                .select(selectStr, { count: "exact" })
                .order("date", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: true });

            // ── Ownership filter (Option A: full legacy fallback) ──────────
            // Replicates the client-side filter that was at lines 107-125 of
            // the original MarketingClient so that Excel-imported rows whose
            // created_by points to the admin importer are still visible to the
            // actual rep whose name is in candidate_name / created_by_name.
            if (filterByUid || filterByName) {
                // /dashboard/employees/[uid] path — admin viewing one employee
                const orParts: string[] = [];
                if (filterByUid) orParts.push(`created_by.eq.${filterByUid}`);
                if (filterByName) {
                    // Escape for ILIKE; names are DB-sourced, not user-typed,
                    // but we still strip commas (PostgREST delimiter).
                    const safeName = escapeLike(filterByName);
                    orParts.push(`created_by_name.ilike.${safeName}`);
                    orParts.push(`candidate_name.ilike.%${safeName}%`);
                }
                if (orParts.length > 0) {
                    query = query.or(orParts.join(","));
                }
            } else if (restrictToUser && profile?.role !== "Admin" && !isMarketingTeamLead(profile)) {
                // /dashboard/data path — employee viewing their own records.
                // Admin and Marketing Team Lead (incl. T&D Manager override)
                // see every employee's rows, same as the unrestricted table.
                const uid = profile?.uid || "";
                const userName = escapeLike(profile?.fullName?.toLowerCase() || "");
                if (uid || userName) {
                    const orParts: string[] = [];
                    if (uid) orParts.push(`created_by.eq.${uid}`);
                    if (userName) {
                        orParts.push(`created_by_name.ilike.${userName}`);
                        // Partial name match replicates the original .includes()
                        orParts.push(`candidate_name.ilike.%${userName}%`);
                    }
                    query = query.or(orParts.join(","));
                }
            }

            // ── Server-side search ─────────────────────────────────────────
            if (debouncedSearch) {
                const pattern = buildSearchPattern(debouncedSearch.toLowerCase());
                // Match on candidate_name OR company_name, mirroring the
                // original normalised client-side filter.
                query = query.or(
                    `candidate_name.ilike.${pattern},company_name.ilike.${pattern}`
                );
            }

            // ── Server-side date range ─────────────────────────────────────
            if (startDate) query = query.gte("date", startDate);
            if (endDate) query = query.lte("date", endDate);

            return query;
        },
        [debouncedSearch, startDate, endDate, filterByUid, filterByName, restrictToUser, profile?.uid, profile?.role, profile?.fullName]
    );

    // ── Paginated fetch ────────────────────────────────────────────────────
    const fetchPage = useCallback(
        async (reset: boolean) => {
            if (!profile) return;

            const currentOffset = reset ? 0 : offset;
            if (reset) {
                setLoading(true);
                setSelectedRows([]);
            } else {
                setLoadingMore(true);
            }

            try {
                const supabase = createClient();
                const { data: rows, count, error } = await buildBaseQuery(supabase, "*")
                    .range(currentOffset, currentOffset + PAGE_SIZE - 1);

                if (error) throw error;

                const mapped = (rows || []).map(marketingRowToUi);

                if (reset) {
                    setData(mapped);
                    setOffset(PAGE_SIZE);
                } else {
                    setData((prev) => [...prev, ...mapped]);
                    setOffset((prev) => prev + PAGE_SIZE);
                }

                // Always refresh totalCount so "X of Y" stays accurate after
                // realtime inserts / deletes from other users.
                setTotalCount(count ?? 0);
            } catch (error: any) {
                if (error?.name !== "AbortError") {
                    console.error("Failed to fetch marketing data:", error);
                }
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [buildBaseQuery, offset, profile]
    );

    // ── Initial fetch + realtime subscription ──────────────────────────────
    useEffect(() => {
        let isMounted = true;

        // Full page reset whenever filters or profile change
        const doReset = async () => {
            if (!profile) return;
            setLoading(true);
            setSelectedRows([]);

            try {
                const supabase = createClient();
                const { data: rows, count, error } = await buildBaseQuery(supabase, "*")
                    .range(0, PAGE_SIZE - 1);

                if (!isMounted) return;
                if (error) throw error;

                setData((rows || []).map(marketingRowToUi));
                setOffset(PAGE_SIZE);
                setTotalCount(count ?? 0);
            } catch (err: any) {
                if (err?.name !== "AbortError") console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        doReset();

        // Realtime: any change on the marketing table triggers a page reset
        // (same filters, back to page 1) so the view stays fresh without
        // downloading the entire table.
        const supabase = createClient();
        let timeoutId: NodeJS.Timeout;

        const channel = supabase
            .channel(`marketing_live_${Math.random().toString(36).slice(2)}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "marketing" }, () => {
                if (isMounted) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        if (isMounted) doReset();
                    }, 500);
                }
            })
            .subscribe();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            supabase.removeChannel(channel);
        };
    // Re-runs when filters or profile change (debounced search already resets offset)
    }, [profile?.uid, profile?.role, profile?.fullName, filterByUid, filterByName, debouncedSearch, startDate, endDate]);

    // ── Delete handlers ────────────────────────────────────────────────────

    const handleDeleteSingle = async () => {
        if (!recordToDelete) return;
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("marketing")
                .delete()
                .eq("id", recordToDelete);
            if (error) throw error;
            // Optimistic removal from local list
            setData((prev) => prev.filter((r) => r.id !== recordToDelete));
            setTotalCount((prev) => Math.max(0, prev - 1));
            setDeleteModalOpen(false);
            setRecordToDelete(null);
            toast.success("Record deleted successfully.");
        } catch (error) {
            console.error("Error deleting record:", error);
            toast.error("Error deleting record.");
        }
    };

    const executeDeleteCandidate = async () => {
        if (!candidateToDelete?.id) return;
        const row = candidateToDelete;
        setData((prev) => prev.filter((r) => r.id !== row.id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("marketing")
                .delete()
                .eq("id", row.id);
            if (error) throw error;
            toast.success("Record removed.");
        } catch (e) {
            console.error("Error deleting record", e);
            toast.error("Error deleting record.");
            // Rollback on failure: re-run a fresh page reset
            setOffset(0);
        } finally {
            setCandidateToDelete(null);
        }
    };

    const handleBulkDelete = async () => {
        try {
            const supabase = createClient();
            const CHUNK_SIZE = 150;
            for (let i = 0; i < selectedRows.length; i += CHUNK_SIZE) {
                const chunk = selectedRows.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase
                    .from("marketing")
                    .delete()
                    .in("id", chunk);
                if (error) throw error;
            }
            setData((prev) => prev.filter((r) => !selectedRows.includes(r.id)));
            setTotalCount((prev) => Math.max(0, prev - selectedRows.length));
            setSelectedRows([]);
            setBulkDeleteModalOpen(false);
            toast.success("Selected records deleted successfully.");
        } catch (error) {
            console.error("Error deleting multiple records:", error);
            toast.error("Error deleting records.");
        }
    };

    // ── Inline Add ─────────────────────────────────────────────────────────

    const updateNewRow = (id: string, field: string, value: string) => {
        setNewRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const handleSaveNewRows = async () => {
        const validRows = newRows.filter((r) => r.CompanyName.trim() !== "");
        if (validRows.length === 0) {
            toast.error("Please enter at least one Company Name");
            return;
        }
        setSavingRow(true);
        try {
            const supabase = createClient();
            const rowsToInsert = validRows.map((row) =>
                marketingUiToRow(
                    {
                        Name: row.CandidateName || "Unknown Candidate",
                        Date: row.Date,
                        "Company Name": row.CompanyName,
                        Link: row.Link,
                    },
                    profile?.uid || null,
                    profile?.fullName || "rohit"
                )
            );

            const { data: inserted, error } = await supabase
                .from("marketing")
                .insert(rowsToInsert)
                .select();
            if (error) throw error;

            const addedPayloads = (inserted || []).map(marketingRowToUi);
            // Optimistic prepend
            setData((prev) => [...addedPayloads, ...prev]);
            setTotalCount((prev) => prev + addedPayloads.length);

            toast.success(`Successfully saved ${validRows.length} entries!`);
            setNewRows([createEmptyRow()]);
            setIsAddingNew(false);
        } catch (error) {
            console.error("Error adding rows:", error);
            toast.error("Failed to save entries");
        } finally {
            setSavingRow(false);
        }
    };

    // ── Export XL ──────────────────────────────────────────────────────────
    // Makes its own FULL (unpaginated) query with the same active filters so
    // the export always contains every matching row, not just the visible page.
    const handleExport = async () => {
        try {
            toast.info("Preparing export...");
            const supabase = createClient();
            // No .range() → full result set
            const { data: rows, error } = await buildBaseQuery(supabase, "*");
            if (error) throw error;

            const exportData = (rows || []).map((row: any) => ({
                Name: row.candidate_name || "",
                date: row.date || "",
                "company name": row.company_name || "",
                link: row.link || "",
            }));

            const worksheet = xlsx.utils.json_to_sheet(exportData);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "MarketingData");
            xlsx.writeFile(
                workbook,
                `marketing_data_${new Date().toISOString().split("T")[0]}.xlsx`
            );
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Export failed. Please try again.");
        }
    };

    // ── Import XL ──────────────────────────────────────────────────────────

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = xlsx.read(bstr, { type: "binary", cellDates: false });
                const parsed = parseMarketingWorkbook(workbook);

                if (!parsed.ok) {
                    if (parsed.kind === "empty-workbook") {
                        setImportSummary(`Import Complete!\n\n${parsed.error}`);
                        toast.info("No valid data rows found in this file.");
                    } else {
                        setImportSummary(`Import Failed!\n\n${parsed.error}`);
                        toast.error(parsed.error.split("\n")[0]);
                    }
                    return;
                }

                const { rows: parsedRows, diagnostics } = parsed;

                if (parsedRows.length === 0) {
                    setImportSummary(
                        "Import Complete!\n\n" +
                        `Total Rows Found: ${diagnostics.rowsScanned - diagnostics.blankRowsSkipped}\n` +
                        "New Records Imported: 0\n" +
                        "No valid data rows found in this file."
                    );
                    toast.success("Import processing completed!");
                    return;
                }

                const supabase = createClient();
                const BATCH_SIZE = 490;
                let pending: any[] = [];
                let newCount = 0;

                const flush = async () => {
                    if (pending.length === 0) return;
                    const { error } = await supabase.from("marketing").insert(pending);
                    if (error) throw error;
                    pending = [];
                };

                for (const parsedRow of parsedRows) {
                    pending.push(
                        marketingUiToRow(
                            {
                                Name: parsedRow.name,
                                Date: parsedRow.date,
                                "Company Name": parsedRow.companyName,
                                Link: parsedRow.link,
                            },
                            profile?.uid || null,
                            profile?.fullName || "rohit"
                        )
                    );
                    newCount++;
                    if (pending.length === BATCH_SIZE) await flush();
                }
                await flush();

                const ambiguousCount = diagnostics.rejects.filter(
                    (r) => r.reason === "ambiguous-date"
                ).length;
                const unreadableCount = diagnostics.rejects.filter(
                    (r) => r.reason === "unreadable-date"
                ).length;
                const skippedCount = diagnostics.rejects.filter(
                    (r) => r.reason === "no-lead-info"
                ).length;

                setImportSummary(
                    "Import Complete!\n\n" +
                    `Sheet: ${diagnostics.sheetName}\n` +
                    `Columns Detected: Name, Date, Company Name${diagnostics.columns.link >= 0 ? ", Link" : ""}\n` +
                    `Total Rows Found: ${diagnostics.rowsScanned - diagnostics.blankRowsSkipped}\n` +
                    `New Records Imported: ${newCount}\n` +
                    `Invalid Rows Skipped: ${skippedCount}` +
                    (diagnostics.missingDateRows > 0 ? `\nRows Without A Date: ${diagnostics.missingDateRows}` : "") +
                    (diagnostics.repairedDateRows > 0 ? `\nDates Corrected (day/month swapped by Excel): ${diagnostics.repairedDateRows}` : "") +
                    (ambiguousCount > 0 ? `\nAmbiguous Dates Not Imported: ${ambiguousCount}` : "") +
                    (unreadableCount > 0 ? `\nUnreadable Dates Not Imported: ${unreadableCount}` : "")
                );
                toast.success("Import processing completed!");
                // Realtime will trigger a page reset automatically; no manual
                // fetchData() needed.
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

    // ── Selection helpers ──────────────────────────────────────────────────

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRows(data.map((r) => r.id));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (id: string) => {
        setSelectedRows((prev) =>
            prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
        );
    };

    // ── Display helpers ────────────────────────────────────────────────────

    const formatDisplayDate = (dateStr: any) => formatCanonicalDate(dateStr);

    const hasMore = data.length < totalCount;

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <>
            <div className="space-y-6">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search candidates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="text-sm px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-700 bg-slate-50 transition-colors"
                            />
                            <div className="h-5 w-px bg-slate-200" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="text-sm px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-700 bg-slate-50 transition-colors"
                            />
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => { setStartDate(""); setEndDate(""); }}
                                    className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        {profile?.role === "Admin" && selectedRows.length > 0 && (
                            <button
                                onClick={() => setBulkDeleteModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-semibold text-sm rounded-xl transition-all border border-red-200 shadow-sm whitespace-nowrap"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete ({selectedRows.length})
                            </button>
                        )}
                        <button
                            onClick={() => setIsAddingNew(!isAddingNew)}
                            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0 ${
                                isAddingNew
                                    ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                    : "bg-slate-900 text-white hover:bg-slate-800"
                            }`}
                        >
                            <Plus className="w-4 h-4" />
                            {isAddingNew ? "Cancel Adding" : "Add Data"}
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
                            className={`flex items-center gap-2 px-4 py-2.5 ${
                                importing
                                    ? "bg-blue-50 text-blue-400"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                            } font-semibold text-sm rounded-xl transition-all border border-blue-200 shadow-sm whitespace-nowrap shrink-0`}
                            title="Import from Excel"
                        >
                            <Download className={`w-4 h-4 ${importing ? "animate-bounce" : ""}`} />
                            {importing ? "Importing..." : "Import XL"}
                        </button>
                        {profile?.role !== "Admin" && (
                            <button
                                onClick={() => setReportModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 font-semibold text-sm rounded-xl transition-all border border-purple-200 shadow-sm whitespace-nowrap"
                                title="Generate Daily Report"
                            >
                                <TableIcon className="w-4 h-4" />
                                Generate Report
                            </button>
                        )}
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

                {/* Row count — shows server-accurate total */}
                {!loading && (
                    <p className="text-xs font-medium text-slate-500">
                        Showing {data.length.toLocaleString()} of {totalCount.toLocaleString()} result{totalCount === 1 ? "" : "s"}
                    </p>
                )}

                <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
                    <div className="overflow-auto h-[600px] max-h-[calc(100vh-280px)] custom-scrollbar pb-6">
                        <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full text-sm text-left relative">
                                <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        {profile?.role === "Admin" && (
                                            <th className="px-6 py-4 font-semibold whitespace-nowrap w-12">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={data.length > 0 && selectedRows.length === data.length}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                        )}
                                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Candidate Name</th>
                                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Date</th>
                                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Company Name</th>
                                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Link</th>
                                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Added By</th>
                                        {profile?.role === "Admin" && (
                                            <th className="px-6 py-4 font-semibold whitespace-nowrap text-right">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {/* Inline Add Rows */}
                                    {isAddingNew && (
                                        <>
                                            {newRows.map((row, index) => (
                                                <tr
                                                    key={row.id}
                                                    className="bg-slate-50/30 border-b border-slate-200/60 hover:bg-slate-50/80 transition-colors group"
                                                >
                                                    {profile?.role === "Admin" && <td className="px-6 py-4"></td>}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input
                                                            type="text"
                                                            placeholder="Candidate Name..."
                                                            value={row.CandidateName || ""}
                                                            onChange={(e) => updateNewRow(row.id, "CandidateName", e.target.value)}
                                                            className="w-full text-sm px-4 py-2.5 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300"
                                                            autoFocus={index === 0}
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input
                                                            type="date"
                                                            value={row.Date}
                                                            onChange={(e) => updateNewRow(row.id, "Date", e.target.value)}
                                                            className="w-full text-sm px-4 py-2.5 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 transition-all hover:border-slate-300"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <input
                                                            type="text"
                                                            placeholder="Enter company name..."
                                                            value={row.CompanyName}
                                                            onChange={(e) => updateNewRow(row.id, "CompanyName", e.target.value)}
                                                            className="w-full text-sm px-4 py-2.5 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <input
                                                            type="url"
                                                            placeholder="https://example.com/job"
                                                            value={row.Link}
                                                            onChange={(e) => updateNewRow(row.id, "Link", e.target.value)}
                                                            className="w-full text-sm px-4 py-2.5 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-slate-700">{profile?.fullName || "Unknown"}</span>
                                                            <span className="text-[10px] text-slate-400 mt-0.5 tracking-wide uppercase">(Auto-tagged)</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                                        {newRows.length > 1 && (
                                                            <button
                                                                onClick={() => setNewRows(newRows.filter((r) => r.id !== row.id))}
                                                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Remove row"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-50/50 border-b border-slate-200/60">
                                                <td colSpan={profile?.role === "Admin" ? 7 : 6} className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={() => setNewRows([...newRows, createEmptyRow()])}
                                                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-bold px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            Add another row
                                                        </button>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => setIsAddingNew(false)}
                                                                className="text-sm text-slate-500 hover:text-slate-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-200/50 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handleSaveNewRows}
                                                                disabled={savingRow}
                                                                className="flex items-center gap-2 text-white bg-slate-900 hover:bg-black px-6 py-2.5 rounded-xl transition-all font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-70"
                                                            >
                                                                <Save className="w-4 h-4" />
                                                                {savingRow ? "Saving..." : "Save Entries"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </>
                                    )}

                                    {/* Data rows */}
                                    {!isAddingNew && (
                                        loading ? (
                                            <tr>
                                                <td colSpan={profile?.role === "Admin" ? 7 : 5} className="px-6 py-12 text-center text-slate-500 font-medium">
                                                    Loading data...
                                                </td>
                                            </tr>
                                        ) : data.length === 0 ? (
                                            <tr>
                                                <td colSpan={profile?.role === "Admin" ? 7 : 5} className="px-6 py-12 text-center text-slate-500 font-medium">
                                                    No data available
                                                </td>
                                            </tr>
                                        ) : (
                                            data.map((row, idx) => (
                                                <tr
                                                    key={row.id || idx}
                                                    className={`hover:bg-slate-100 transition-colors group ${
                                                        selectedRows.includes(row.id)
                                                            ? "bg-blue-50/30"
                                                            : idx % 2 === 0
                                                            ? "bg-white"
                                                            : "bg-slate-50"
                                                    }`}
                                                >
                                                    {profile?.role === "Admin" && (
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                checked={selectedRows.includes(row.id)}
                                                                onChange={() => handleSelectRow(row.id)}
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                                                        {row["Name"] || "-"}
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                                                        {formatDisplayDate(row["Date"])}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                                                        {row["Company Name"] || "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-blue-600 hover:underline whitespace-nowrap">
                                                        {row["Link"] ? (
                                                            <a href={row["Link"]} target="_blank" rel="noopener noreferrer">
                                                                {String(row["Link"]).substring(0, 40)}
                                                                {String(row["Link"]).length > 40 ? "..." : ""}
                                                            </a>
                                                        ) : "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                                                        {row["marketing"] || "-"}
                                                    </td>
                                                    {profile?.role === "Admin" && (
                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                            <button
                                                                onClick={() => {
                                                                    setRecordToDelete(row.id);
                                                                    setDeleteModalOpen(true);
                                                                }}
                                                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                                title="Delete record"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Load More */}
                        {!loading && !isAddingNew && hasMore && (
                            <div className="py-6 flex justify-center border-t border-slate-100">
                                <button
                                    onClick={() => fetchPage(false)}
                                    disabled={loadingMore}
                                    className="px-6 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-semibold text-sm rounded-xl transition-all border border-blue-100 shadow-sm disabled:opacity-60"
                                >
                                    {loadingMore
                                        ? "Loading..."
                                        : `Load More (${(totalCount - data.length).toLocaleString()} remaining)`}
                                </button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Single Delete Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Record</h3>
                            <p className="text-slate-500 text-sm">
                                Are you sure you want to delete this record? This action cannot be undone and will permanently remove this data.
                            </p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button
                                onClick={() => { setDeleteModalOpen(false); setRecordToDelete(null); }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSingle}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                            >
                                Yes, delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Modal */}
            {bulkDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete {selectedRows.length} Records</h3>
                            <p className="text-slate-500 text-sm">
                                Are you sure you want to delete {selectedRows.length} records? This action cannot be undone and will permanently remove this data.
                            </p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button
                                onClick={() => setBulkDeleteModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                            >
                                Yes, delete all
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            <GenerateReportModal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                profile={profile}
                startDate={startDate}
                endDate={endDate}
            />
        </>
    );
}
