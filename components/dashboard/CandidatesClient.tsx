"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
    Search, Plus, X, AlertCircle, Trash2, Pencil, UserSearch, Download,
    FolderOpen, ExternalLink,
} from "lucide-react";
import * as xlsx from "xlsx";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

// Shared Drive folder holding candidate documents. Access is governed by
// Google's own sharing settings, not by this app.
const CANDIDATE_DOCS_URL =
    "https://drive.google.com/drive/u/1/folders/1nNIXdIQdiFWxQ23_0MBtcffhCyJlpP6o";

// Must stay in step with the status check constraint on public.candidates.
const STATUSES = ["New", "Contacted", "Interviewing", "Selected", "Rejected", "On Hold"] as const;
type Status = (typeof STATUSES)[number];

interface Candidate {
    id: string;
    full_name: string;
    phone: string | null;
    marketing_email: string | null;
    marketing_password: string | null;
    linkedin_email: string | null;
    linkedin_password: string | null;
    technology: string | null;
    visa_status: string | null;
    status: Status;
    notes: string;
    assigned_to: string | null;
    assigned_to_name: string | null;
    created_by_name: string | null;
    created_at: string;
}

interface AssignableEmployee {
    id: string;
    full_name: string;
    designation: string | null;
}

const statusColor = (status: string) => {
    switch (status) {
        case "Selected":
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "Rejected":
            return "bg-rose-50 text-rose-700 border-rose-200";
        case "Interviewing":
            return "bg-blue-50 text-blue-700 border-blue-200";
        case "Contacted":
            return "bg-indigo-50 text-indigo-700 border-indigo-200";
        case "On Hold":
            return "bg-amber-50 text-amber-700 border-amber-200";
        default:
            return "bg-slate-50 text-slate-600 border-slate-200";
    }
};

/** created_at (a UTC timestamp) as the local calendar day, YYYY-MM-DD. */
const localDay = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const emptyForm = {
    full_name: "",
    phone: "",
    marketing_email: "",
    marketing_password: "",
    linkedin_email: "",
    linkedin_password: "",
    technology: "",
    visa_status: "",
    status: "New" as Status,
    assigned_to: "",
    notes: "",
};

export default function CandidatesClient() {
    const { profile } = useAuth();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Candidate | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ ...emptyForm });

    const [toDelete, setToDelete] = useState<Candidate | null>(null);

    // Excel import
    const [importing, setImporting] = useState(false);
    const [importSummary, setImportSummary] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Team-Leads and Admin/HR manage candidates; everyone else is read-only.
     *
     * This only decides what the UI offers â€” the same rule is enforced by the
     * candidates_insert/update/delete policies, so hiding a button is never
     * what actually protects the data.
     */
    const canManage = useMemo(() => {
        if (!profile) return false;
        const role = (profile.role || "").toUpperCase();
        if (role === "ADMIN" || role === "HR" || role === "OPS_HR") return true;
        return role === "MARKETING" && (profile.designation === "Team-Lead" || profile.jobRole === "Team-Lead");
    }, [profile]);

    /**
     * getUser() validates against the auth server and refreshes an expired
     * token. Without it a stale session silently downgrades to `anon`, where
     * reads return zero rows and writes fail with a bare RLS violation.
     */
    const requireSession = async (supabase: ReturnType<typeof createClient>) => {
        const { data, error: authErr } = await supabase.auth.getUser();
        if (authErr || !data?.user) {
            toast.error("Your session has expired. Please refresh the page and sign in again.");
            return null;
        }
        return data.user;
    };

    // RLS does the filtering: an employee's select simply returns only the
    // rows assigned to them, so there is no client-side narrowing to bypass.
    const loadCandidates = useCallback(async () => {
        const supabase = createClient();
        const { data, error: err } = await supabase
            .from("candidates")
            .select("*")
            .order("created_at", { ascending: false });

        if (err) {
            console.error("Load candidates failed:", err.message, err);
            setError("Could not load candidates.");
        } else {
            setError(null);
            setCandidates((data || []) as Candidate[]);
        }
        setLoading(false);
    }, []);

    const loadEmployees = useCallback(async () => {
        const supabase = createClient();
        const { data, error: err } = await supabase
            .from("profiles")
            .select("id, full_name, designation")
            .eq("role", "MARKETING")
            .order("full_name");

        if (err) {
            console.error("Load marketing employees failed:", err.message, err);
            return;
        }
        setEmployees((data || []) as AssignableEmployee[]);
    }, []);

    useEffect(() => {
        if (!profile) return;

        loadCandidates();
        if (canManage) loadEmployees();

        const supabase = createClient();
        const channel = supabase
            .channel(`candidates_live_${Math.random().toString(36).slice(2)}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "candidates" }, () => {
                loadCandidates();
            })
            .subscribe();

        /**
         * Realtime alone cannot clear a row that was reassigned away.
         *
         * Realtime applies RLS to every event, so when a Team-Lead reassigns a
         * candidate to someone else the previous assignee is â€” correctly â€” no
         * longer allowed to see that row and therefore receives no event at
         * all. Their open tab would keep showing it until something else
         * happened to trigger a refetch. Re-reading on focus closes that gap;
         * the row is already inaccessible to them at the database level, this
         * just stops the stale copy lingering on screen.
         */
        const refetchIfVisible = () => {
            if (document.visibilityState === "visible") loadCandidates();
        };
        document.addEventListener("visibilitychange", refetchIfVisible);
        window.addEventListener("focus", refetchIfVisible);

        return () => {
            supabase.removeChannel(channel);
            document.removeEventListener("visibilitychange", refetchIfVisible);
            window.removeEventListener("focus", refetchIfVisible);
        };
    }, [profile, canManage, loadCandidates, loadEmployees]);

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return candidates.filter((c) => {
            if (q) {
                const hit = [
                    c.full_name, c.phone, c.marketing_email, c.linkedin_email,
                    c.technology, c.visa_status, c.status, c.assigned_to_name, c.notes,
                ].some((v) => String(v || "").toLowerCase().includes(q));
                if (!hit) return false;
            }

            if (!startDate && !endDate) return true;

            // Compare as local YYYY-MM-DD strings rather than Date objects:
            // `new Date("2026-08-13")` is parsed as UTC midnight, so a direct
            // comparison shifts the boundary by the timezone offset and drops
            // rows added late in the day.
            const day = localDay(c.created_at);
            if (!day) return false;
            if (startDate && day < startDate) return false;
            if (endDate && day > endDate) return false;
            return true;
        });
    }, [candidates, searchQuery, startDate, endDate]);

    // Suggestions built from what's already in use, so the team converges on
    // consistent values without being locked into a fixed list.
    const technologyOptions = useMemo(
        () => Array.from(new Set(candidates.map((c) => c.technology).filter(Boolean) as string[])).sort(),
        [candidates]
    );
    const visaOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    "F1 OPT",
                    "F1 STEM OPT",
                    ...(candidates.map((c) => c.visa_status).filter(Boolean) as string[]),
                ])
            ).sort(),
        [candidates]
    );

    const openAdd = () => {
        setEditing(null);
        setForm({ ...emptyForm });
        setFormOpen(true);
    };

    const openEdit = (c: Candidate) => {
        setEditing(c);
        setForm({
            full_name: c.full_name,
            phone: c.phone || "",
            marketing_email: c.marketing_email || "",
            marketing_password: c.marketing_password || "",
            linkedin_email: c.linkedin_email || "",
            linkedin_password: c.linkedin_password || "",
            technology: c.technology || "",
            visa_status: c.visa_status || "",
            status: c.status,
            assigned_to: c.assigned_to || "",
            notes: c.notes || "",
        });
        setFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.full_name.trim()) {
            toast.error("Candidate name is required.");
            return;
        }

        setSaving(true);
        try {
            const supabase = createClient();
            if (!(await requireSession(supabase))) return;

            const assignee = employees.find((emp) => emp.id === form.assigned_to);
            const payload = {
                full_name: form.full_name.trim(),
                phone: form.phone.trim() || null,
                marketing_email: form.marketing_email.trim() || null,
                marketing_password: form.marketing_password.trim() || null,
                linkedin_email: form.linkedin_email.trim() || null,
                linkedin_password: form.linkedin_password.trim() || null,
                technology: form.technology.trim() || null,
                visa_status: form.visa_status.trim() || null,
                status: form.status,
                notes: form.notes.trim(),
                assigned_to: form.assigned_to || null,
                assigned_to_name: assignee?.full_name || null,
            };

            if (editing) {
                // .select() matters: when RLS blocks a write Supabase returns
                // success with zero rows, which would otherwise be reported to
                // the user as a save that never happened.
                const { data, error: err } = await supabase
                    .from("candidates")
                    .update(payload)
                    .eq("id", editing.id)
                    .select();
                if (err) throw err;
                if (!data || data.length === 0) {
                    toast.error("You do not have permission to edit this candidate.");
                    return;
                }
                toast.success("Candidate updated.");
            } else {
                // created_by is stamped by the set_candidate_owner trigger.
                const { data, error: err } = await supabase
                    .from("candidates")
                    .insert({ ...payload, created_by_name: profile?.fullName || null })
                    .select();
                if (err) throw err;
                if (!data || data.length === 0) {
                    toast.error("You do not have permission to add candidates.");
                    return;
                }
                toast.success("Candidate added.");
            }

            setFormOpen(false);
            setEditing(null);
            setForm({ ...emptyForm });
            loadCandidates();
        } catch (err: any) {
            console.error("Save candidate failed:", err?.message, err);
            toast.error(err?.message || "Could not save candidate.");
        } finally {
            setSaving(false);
        }
    };

    const handleImportClick = () => fileInputRef.current?.click();

    /**
     * Imports the marketing team's candidate sheet.
     *
     * Parsed positionally (`header: 1`) rather than as objects, because the
     * sheet has TWO columns both headed "Password" â€” one for the marketing
     * email, one for LinkedIn. Object parsing would silently collapse or
     * rename the second, so instead each "Password" column is attached to
     * whichever email column preceded it. Header names are matched loosely,
     * and the header row is located by finding "NAME" rather than assuming
     * row 1, since the sheet starts with a blank row.
     */
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const workbook = xlsx.read(evt.target?.result, { type: "binary" });
                const ws = workbook.Sheets[workbook.SheetNames[0]];
                const grid = xlsx.utils.sheet_to_json<any[]>(ws, {
                    header: 1,
                    defval: "",
                    blankrows: false,
                });

                const norm = (v: any) => String(v ?? "").trim().toLowerCase();
                const headerIdx = grid.findIndex((r) => (r || []).some((c) => norm(c) === "name"));
                if (headerIdx === -1) {
                    toast.error('Could not find a "NAME" column header in the sheet.');
                    return;
                }

                const cols: Record<string, number> = {};
                let lastEmail: "marketing" | "linkedin" | null = null;

                (grid[headerIdx] || []).forEach((h: any, i: number) => {
                    const k = norm(h);
                    if (!k) return;
                    if (k === "name" || k === "candidate name") cols.full_name = i;
                    else if (k.includes("contact") || k.includes("phone") || k.includes("mobile")) cols.phone = i;
                    else if (k.includes("marketing") && k.includes("email")) {
                        cols.marketing_email = i;
                        lastEmail = "marketing";
                    } else if ((k.includes("linkedin") || k.includes("linked in")) && k.includes("email")) {
                        cols.linkedin_email = i;
                        lastEmail = "linkedin";
                    } else if (k.includes("password")) {
                        // Belongs to the most recently seen email column.
                        if (lastEmail === "marketing" && cols.marketing_password === undefined)
                            cols.marketing_password = i;
                        else if (lastEmail === "linkedin" && cols.linkedin_password === undefined)
                            cols.linkedin_password = i;
                    } else if (k.includes("technology") || k.includes("tech")) cols.technology = i;
                    else if (k.includes("visa")) cols.visa_status = i;
                });

                const cell = (row: any[], key: string) => {
                    const i = cols[key];
                    if (i === undefined) return null;
                    const v = String(row?.[i] ?? "").trim();
                    return v === "" ? null : v;
                };

                const pending: any[] = [];
                let skipped = 0;

                for (let r = headerIdx + 1; r < grid.length; r++) {
                    const row = grid[r] || [];
                    const name = cell(row, "full_name");
                    if (!name) {
                        // Ignore genuinely blank rows; only count rows that had
                        // some content but no usable name.
                        if (row.some((c: any) => String(c ?? "").trim() !== "")) skipped++;
                        continue;
                    }
                    pending.push({
                        full_name: name,
                        phone: cell(row, "phone"),
                        marketing_email: cell(row, "marketing_email"),
                        marketing_password: cell(row, "marketing_password"),
                        linkedin_email: cell(row, "linkedin_email"),
                        linkedin_password: cell(row, "linkedin_password"),
                        technology: cell(row, "technology"),
                        visa_status: cell(row, "visa_status"),
                        status: "New",
                        notes: "",
                        created_by_name: profile?.fullName || null,
                    });
                }

                if (pending.length === 0) {
                    toast.error("No valid rows found. Each row needs at least a name.");
                    return;
                }

                const supabase = createClient();
                if (!(await requireSession(supabase))) return;

                const { data: inserted, error: err } = await supabase
                    .from("candidates")
                    .insert(pending)
                    .select();

                if (err) {
                    console.error("Candidate import failed:", err.message, err);
                    toast.error(err.message || "Could not import candidates.");
                    return;
                }
                if (!inserted || inserted.length === 0) {
                    toast.error("You do not have permission to import candidates.");
                    return;
                }

                setImportSummary(
                    `Import Complete!\n\nCandidates imported: ${inserted.length}\nSkipped (no name): ${skipped}\n\nImported candidates are Unassigned â€” use the edit button on a row to assign each one to an employee.`
                );
                toast.success(`Imported ${inserted.length} candidate(s).`);
                loadCandidates();
            } catch (error) {
                console.error("Error during candidate import:", error);
                toast.error("Failed to import file. Please check the format.");
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleDeleteConfirmed = async () => {
        if (!toDelete) return;
        try {
            const supabase = createClient();
            if (!(await requireSession(supabase))) return;

            const { data, error: err } = await supabase
                .from("candidates")
                .delete()
                .eq("id", toDelete.id)
                .select();
            if (err) throw err;
            if (!data || data.length === 0) {
                toast.error("You do not have permission to delete this candidate.");
                return;
            }

            setCandidates((prev) => prev.filter((c) => c.id !== toDelete.id));
            toast.success("Candidate deleted.");
        } catch (err: any) {
            console.error("Delete candidate failed:", err?.message, err);
            toast.error("Could not delete candidate.");
        } finally {
            setToDelete(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm text-slate-500 font-medium">Loading candidates...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative w-full lg:max-w-xs lg:min-w-[180px]">
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

                {/* nowrap from lg up so the controls stay on one line once the
                    sidebar is open, rather than dropping the last button. */}
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 lg:shrink-0">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                        <DatePicker
                            value={startDate}
                            onChange={setStartDate}
                            className="h-8 w-36 border-none bg-slate-50"
                        />
                        <div className="h-5 w-px bg-slate-200" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                        <DatePicker
                            value={endDate}
                            onChange={setEndDate}
                            className="h-8 w-36 border-none bg-slate-50"
                        />
                        {(startDate || endDate) && (
                            <button
                                onClick={() => {
                                    setStartDate("");
                                    setEndDate("");
                                }}
                                className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Available to employees as well as leads â€” anyone working
                        a candidate needs their documents. */}
                    <a
                        href={CANDIDATE_DOCS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-semibold text-sm rounded-xl transition-all border border-slate-200 shadow-sm whitespace-nowrap"
                        title="Open the candidate documents folder in Google Drive"
                    >
                        <FolderOpen className="w-4 h-4 text-slate-400" />
                        Candidate Documents
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>

                    {canManage && (
                        <>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-semibold text-sm rounded-xl transition-all shadow-sm whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            Add Candidate
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
                            title="Import candidates from Excel"
                        >
                            <Download className={`w-4 h-4 ${importing ? "animate-bounce" : ""}`} />
                            {importing ? "Importing..." : "Import XL"}
                        </button>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
                    <div className="px-6 py-5 border-b border-slate-100 bg-blue-50/50">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <UserSearch className="h-5 w-5 text-blue-500" />
                            {canManage ? "All Candidates" : "My Candidates"}
                            <span className="bg-blue-200 text-blue-800 text-xs py-0.5 px-2.5 rounded-full font-semibold">
                                {filtered.length}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {canManage
                                ? "Add candidates and assign them to a marketing employee."
                                : "Candidates assigned to you by your Team-Lead."}
                        </p>
                    </div>

                    <div className="overflow-auto max-h-[620px] custom-scrollbar">
                        <div className="overflow-x-auto w-full max-w-full">
<table className="w-full text-sm text-left relative">
                            <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Name</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Contact Number</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Marketing Email</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">LinkedIn Email</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Technology</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Visa Status</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Assigned To</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Notes</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Added On</th>
                                    {canManage && (
                                        <th className="px-6 py-4 font-semibold whitespace-nowrap text-right">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManage ? 11 : 10} className="px-6 py-12 text-center text-slate-500">
                                            {searchQuery || startDate || endDate
                                                ? "No candidates match the current search or date range."
                                                : canManage
                                                  ? "No candidates yet. Use â€œAdd Candidateâ€ to create one."
                                                  : "No candidates have been assigned to you yet."}
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((c, index) => (
                                        <tr
                                            key={c.id}
                                            className={`hover:bg-slate-100 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                                        >
                                            <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap capitalize">
                                                {c.full_name}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                                                {c.phone || "-"}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-600">{c.marketing_email || "-"}</span>
                                                    <span className="font-mono text-[11px] text-slate-400">
                                                        {c.marketing_password || "-"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-600">{c.linkedin_email || "-"}</span>
                                                    <span className="font-mono text-[11px] text-slate-400">
                                                        {c.linkedin_password || "-"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap capitalize">
                                                {c.technology || "-"}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                                {c.visa_status || "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold border ${statusColor(c.status)}`}
                                                >
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap capitalize">
                                                {c.assigned_to_name || <span className="text-slate-400 italic">Unassigned</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 max-w-[240px]">
                                                <span className="block truncate" title={c.notes || ""}>
                                                    {c.notes || "-"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                {formatDate(c.created_at)}
                                            </td>
                                            {canManage && (
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => openEdit(c)}
                                                            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                                                            title="Edit or reassign"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setToDelete(c)}
                                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                            title="Delete this candidate"
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

            <ConfirmModal
                isOpen={!!toDelete}
                onClose={() => setToDelete(null)}
                onConfirm={handleDeleteConfirmed}
                title="Delete Candidate"
                description={`Are you sure you want to delete "${toDelete?.full_name || "this candidate"}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />

            {/* Add / Edit modal */}
            {formOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
                    >
                        <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                                    {editing ? "Edit Candidate" : "Add Candidate"}
                                </h2>
                                <p className="text-xs font-semibold text-slate-500 mt-1">
                                    Assign a candidate to a marketing employee
                                </p>
                            </div>
                            <button
                                onClick={() => setFormOpen(false)}
                                className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Candidate Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.full_name}
                                        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                                        placeholder="e.g. Kaushal Mehta"
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Contact Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                        placeholder="e.g. (551) 323-3630"
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Marketing Email
                                    </label>
                                    <input
                                        type="email"
                                        value={form.marketing_email}
                                        onChange={(e) => setForm((f) => ({ ...f, marketing_email: e.target.value }))}
                                        placeholder="candidate@gmail.com"
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Marketing Email Password
                                    </label>
                                    <input
                                        type="text"
                                        value={form.marketing_password}
                                        onChange={(e) => setForm((f) => ({ ...f, marketing_password: e.target.value }))}
                                        placeholder="e.g. Vectra@1234"
                                        autoComplete="off"
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        LinkedIn Email
                                    </label>
                                    <input
                                        type="email"
                                        value={form.linkedin_email}
                                        onChange={(e) => setForm((f) => ({ ...f, linkedin_email: e.target.value }))}
                                        placeholder="candidate@gmail.com"
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        LinkedIn Password
                                    </label>
                                    <input
                                        type="text"
                                        value={form.linkedin_password}
                                        onChange={(e) => setForm((f) => ({ ...f, linkedin_password: e.target.value }))}
                                        placeholder="e.g. Vectra@1234"
                                        autoComplete="off"
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Technology
                                    </label>
                                    <input
                                        type="text"
                                        list="candidate-technology-options"
                                        value={form.technology}
                                        onChange={(e) => setForm((f) => ({ ...f, technology: e.target.value }))}
                                        placeholder="e.g. Data Scientist"
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                    />
                                    <datalist id="candidate-technology-options">
                                        {technologyOptions.map((opt) => (
                                            <option key={opt} value={opt} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Visa Status
                                    </label>
                                    <input
                                        type="text"
                                        list="candidate-visa-options"
                                        value={form.visa_status}
                                        onChange={(e) => setForm((f) => ({ ...f, visa_status: e.target.value }))}
                                        placeholder="e.g. F1 STEM OPT"
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm"
                                    />
                                    <datalist id="candidate-visa-options">
                                        {visaOptions.map((opt) => (
                                            <option key={opt} value={opt} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Status
                                    </label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
                                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm cursor-pointer"
                                    >
                                        {STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Assign To
                                    </label>
                                    <select
                                        value={form.assigned_to}
                                        onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm cursor-pointer"
                                    >
                                        <option value="">Unassigned</option>
                                        {employees.map((emp) => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.full_name}
                                                {emp.designation ? ` - ${emp.designation}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-400 mt-1.5">
                                        Only the assigned employee can see this candidate.
                                    </p>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
                                        Notes
                                    </label>
                                    <textarea
                                        value={form.notes}
                                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                        placeholder="Any details the assigned employee should know..."
                                        rows={3}
                                        className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-md"
                                >
                                    {saving ? "Saving..." : editing ? "Save changes" : "Add candidate"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormOpen(false)}
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


