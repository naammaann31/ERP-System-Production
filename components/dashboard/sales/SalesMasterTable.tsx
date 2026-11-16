"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as xlsx from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";
import { Upload, Search, X, Users, UserCheck, UserX, Loader2, Inbox, ExternalLink, Plus, Save, Trash2, FilePlus2, ArrowUpDown } from "lucide-react";
import {
  parseSalesLeadsWorkbook,
  normalizePhoneForCompare,
  normalizeEmailForCompare,
  SALES_LEAD_STATUSES,
} from "@/lib/salesLeadsImport";

const PAGE_SIZE = 100;

function escapeLike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "");
}
function buildSearchPattern(str: string): string {
  const escaped = escapeLike(str).replace(/[\s\-_]+/g, "%");
  return `%${escaped}%`;
}

const statusColors: Record<string, string> = {
  "Attempt 1": "bg-slate-100 text-slate-600",
  "Attempt 2": "bg-slate-100 text-slate-600",
  "Attempt 3": "bg-slate-100 text-slate-600",
  "Follow up requested": "bg-amber-50 text-amber-700",
  "Interested": "bg-emerald-50 text-emerald-700",
  "Not interested": "bg-red-50 text-red-700",
  "Meeting scheduled": "bg-blue-50 text-blue-700",
  "Closed": "bg-slate-800 text-white",
  "Dead Lead": "bg-red-50 text-red-700",
};

// Master Data and Sales Data both read/write the SAME sales_leads table now
// (no separate queue table) - "Master Data" is just the unfiltered,
// privileged view with an assigned/unassigned lens on top of it. Assigning
// a row here is a plain UPDATE on that exact row; there is no second copy
// to create or link anywhere anymore.
export default function SalesMasterTable() {
  const { profile } = useAuth();

  const [rows, setRows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entryDateFrom, setEntryDateFrom] = useState("");
  const [entryDateTo, setEntryDateTo] = useState("");
  const [statusDateFrom, setStatusDateFrom] = useState("");
  const [statusDateTo, setStatusDateTo] = useState("");
  const [dateSortField, setDateSortField] = useState<"entry_date" | "status_updated_work_date">("entry_date");
  const [dateSortDir, setDateSortDir] = useState<"asc" | "desc">("desc");
  const [assignmentFilter, setAssignmentFilter] = useState<"all" | "unassigned" | "assigned">("all");

  const [employees, setEmployees] = useState<{ uid: string; fullName: string }[]>([]);
  const [customColumns, setCustomColumns] = useState<any[]>([]);

  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState({ total: 0, assigned: 0, unassigned: 0 });

  // ── Manual "Add Data" rows ───────────────────────────────────────────────
  const createEmptyMasterRow = () => ({
    id: Math.random().toString(36).slice(2),
    name: "",
    mobile: "",
    email: "",
    linkedin_url: "",
    assigned_to: "",
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRows, setNewRows] = useState([createEmptyMasterRow()]);
  const [savingRows, setSavingRows] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadStats = useCallback(async () => {
    const supabase = createClient();
    const [total, assigned, unassigned] = await Promise.all([
      supabase.from("sales_leads").select("id", { count: "exact" }).limit(1),
      supabase.from("sales_leads").select("id", { count: "exact" }).not("assigned_to", "is", null).limit(1),
      supabase.from("sales_leads").select("id", { count: "exact" }).is("assigned_to", null).limit(1),
    ]);
    if (total.error || assigned.error || unassigned.error) {
      console.error("Failed to load master stats:", total.error || assigned.error || unassigned.error);
    }
    setStats({ total: total.count ?? 0, assigned: assigned.count ?? 0, unassigned: unassigned.count ?? 0 });
  }, []);

  const loadEmployees = useCallback(async () => {
    const supabase = createClient();
    // Only ACTIVE Sales-department employees are ever eligible assignees -
    // an Inactive employee (even a former real one) is never auto- or
    // manually- assignable; their old rows stay/land unassigned instead.
    const { data } = await supabase.from("profiles").select("id, full_name").eq("role", "SALES").neq("status", "Inactive");
    setEmployees((data || []).map((r: any) => ({ uid: r.id, fullName: r.full_name })));
  }, []);

  useEffect(() => {
    loadEmployees();
    const load = async () => {
      const supabase = createClient();
      const { data: cols } = await supabase.from("sales_custom_columns").select("*").order("column_order", { ascending: true });
      setCustomColumns(cols || []);
    };
    load();
  }, [loadEmployees]);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      reset ? setLoading(true) : setLoadingMore(true);
      const supabase = createClient();
      let query = supabase
        .from("sales_leads")
        .select("*, assigned_profile:profiles!sales_leads_assigned_to_fkey(full_name)", { count: "exact" });

      if (assignmentFilter === "unassigned") query = query.is("assigned_to", null);
      if (assignmentFilter === "assigned") query = query.not("assigned_to", "is", null);
      if (debouncedSearch) {
        const pattern = buildSearchPattern(debouncedSearch);
        query = query.or(`name.ilike.${pattern},email.ilike.${pattern},mobile.ilike.${pattern}`);
      }
      if (entryDateFrom) query = query.gte("entry_date", entryDateFrom);
      if (entryDateTo) query = query.lte("entry_date", entryDateTo);
      if (statusDateFrom) query = query.gte("status_updated_work_date", statusDateFrom);
      if (statusDateTo) query = query.lte("status_updated_work_date", statusDateTo);

      query = query
        .order(dateSortField, { ascending: dateSortDir === "asc", nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true }); // stable tie-breaker for .range() pagination

      const from = reset ? 0 : offset;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) {
        toast.error("Failed to load leads: " + error.message);
      } else {
        setRows((prev) => (reset ? data || [] : [...prev, ...(data || [])]));
        setTotalCount(count || 0);
        setOffset(from + (data?.length || 0));
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [debouncedSearch, entryDateFrom, entryDateTo, statusDateFrom, statusDateTo, dateSortField, dateSortDir, assignmentFilter, offset]
  );

  useEffect(() => {
    fetchPage(true);
    setSelectedIds(new Set());
    anchorIndexRef.current = null;
    cursorIndexRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, entryDateFrom, entryDateTo, statusDateFrom, statusDateTo, dateSortField, dateSortDir, assignmentFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Assigning/reassigning/clearing is now just one UPDATE on the one row
  // that already exists - no second table, no copy, no link to maintain.
  const handleAssign = async (row: any, uid: string, silent = false) => {
    const supabase = createClient();
    const employee = employees.find((e) => e.uid === uid);
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, assigned_to: uid || null, assigned_profile: employee ? { full_name: employee.fullName } : null } : r))
    );
    const { error } = await supabase.from("sales_leads").update({ assigned_to: uid || null }).eq("id", row.id);
    if (error) {
      if (!silent) toast.error("Failed to update owner: " + error.message);
      return;
    }
    if (!silent) {
      toast.success(uid ? "Lead reassigned" : "Lead unassigned");
      loadStats();
    }
  };

  const updateRowField = async (id: string, field: string, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    const supabase = createClient();
    const { error } = await supabase.from("sales_leads").update({ [field]: value }).eq("id", id);
    if (error) toast.error("Failed to save: " + error.message);
  };

  // ── Bulk selection + bulk assign ─────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const anchorIndexRef = useRef<number | null>(null);
  const cursorIndexRef = useRef<number | null>(null);

  const applyRangeSelection = (anchor: number, cursor: number) => {
    const [start, end] = anchor <= cursor ? [anchor, cursor] : [cursor, anchor];
    setSelectedIds(new Set(rows.slice(start, end + 1).map((r) => r.id)));
  };

  useEffect(() => {
    const isTextEntryTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement;
      const tag = node?.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag === "INPUT") {
        const type = (node as HTMLInputElement).type;
        return type !== "checkbox" && type !== "button";
      }
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || isTextEntryTarget(e.target) || rows.length === 0) return;
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      if (anchorIndexRef.current === null) {
        anchorIndexRef.current = e.key === "ArrowDown" ? 0 : rows.length - 1;
        cursorIndexRef.current = anchorIndexRef.current;
      } else {
        cursorIndexRef.current = Math.min(Math.max((cursorIndexRef.current ?? anchorIndexRef.current) + delta, 0), rows.length - 1);
      }
      applyRangeSelection(anchorIndexRef.current, cursorIndexRef.current!);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const handleRowCheckboxClick = (index: number, id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    anchorIndexRef.current = index;
    cursorIndexRef.current = index;
  };

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const allSelected = rows.every((r) => prev.has(r.id));
      if (allSelected) return new Set();
      return new Set(rows.map((r) => r.id));
    });
    anchorIndexRef.current = null;
    cursorIndexRef.current = null;
  };

  const handleBulkAssign = async (uid: string) => {
    const targets = rows.filter((r) => selectedIds.has(r.id));
    if (targets.length === 0 || !uid) return;
    setBulkAssigning(true);
    try {
      for (const row of targets) {
        await handleAssign(row, uid, true);
      }
      toast.success(`Assigned ${targets.length} lead(s) to ${employees.find((e) => e.uid === uid)?.fullName || "employee"}`);
      setSelectedIds(new Set());
      anchorIndexRef.current = null;
      cursorIndexRef.current = null;
      loadStats();
      fetchPage(true);
    } finally {
      setBulkAssigning(false);
    }
  };

  const updateNewRow = (id: string, field: string, value: string) => {
    setNewRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // Manual entry - management only (this whole component only renders for
  // Team-Lead/Manager/Admin/HR; RLS backs this up independently). Duplicate
  // candidates are allowed by design - this is informational only, never
  // blocking.
  const handleSaveNewRows = async () => {
    const validRows = newRows.filter((r) => r.name.trim() !== "");
    if (validRows.length === 0) {
      toast.error("Please enter at least a name");
      return;
    }
    if (!profile?.uid) return;
    setSavingRows(true);
    try {
      const supabase = createClient();
      const { data: existing } = await supabase.from("sales_leads").select("mobile,email");
      const existingPhones = new Set<string>();
      const existingEmails = new Set<string>();
      (existing || []).forEach((r: any) => {
        if (r.mobile) existingPhones.add(normalizePhoneForCompare(r.mobile));
        if (r.email) existingEmails.add(normalizeEmailForCompare(r.email));
      });

      let infoDupCount = 0;
      const toInsert = validRows.map((row) => {
        const np = normalizePhoneForCompare(row.mobile);
        const ne = normalizeEmailForCompare(row.email);
        if ((np && existingPhones.has(np)) || (ne && existingEmails.has(ne))) infoDupCount++;
        return {
          name: row.name.trim(),
          mobile: row.mobile.trim() || null,
          email: row.email.trim() || null,
          linkedin_url: row.linkedin_url.trim() || null,
          visa: null,
          status: null,
          country: null,
          remarks: null,
          entry_date: new Date().toISOString().split("T")[0],
          assigned_to: row.assigned_to || null,
          created_by: profile.uid,
          custom_fields: {},
        };
      });

      const { error } = await supabase.from("sales_leads").insert(toInsert);
      if (error) throw error;

      toast.success(`Added ${toInsert.length} lead(s)${infoDupCount ? ` (${infoDupCount} look like existing candidates - kept as separate entries)` : ""}`);
      setNewRows([createEmptyMasterRow()]);
      setIsAddingNew(false);
      await fetchPage(true);
      loadStats();
    } catch (err: any) {
      toast.error("Failed to save: " + (err?.message || "unknown error"));
    } finally {
      setSavingRows(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.uid) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = xlsx.read(buf, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      const todayIso = new Date().toISOString().split("T")[0];
      const { rows: parsed, newCustomColumns, skippedNoName } = parseSalesLeadsWorkbook(wb, todayIso, sheetName);

      const supabase = createClient();

      // Informational only - every valid row is inserted regardless. This
      // only drives the toast message ("N look like existing candidates").
      const { data: existing } = await supabase.from("sales_leads").select("mobile,email");
      const existingPhones = new Set<string>();
      const existingEmails = new Set<string>();
      (existing || []).forEach((r: any) => {
        if (r.mobile) existingPhones.add(normalizePhoneForCompare(r.mobile));
        if (r.email) existingEmails.add(normalizeEmailForCompare(r.email));
      });

      await loadEmployees();
      const { data: freshEmployees } = await supabase.from("profiles").select("id, full_name").eq("role", "SALES").neq("status", "Inactive");
      // Full name first, then unique-first-name fallback (real sheets use
      // "Diya"/"Honey" etc., not full names) - ONLY among ACTIVE Sales
      // employees. An inactive or nonexistent name is never auto-assigned;
      // it's preserved in custom_fields.original_assigned_to instead and
      // the row stays unassigned for management to resolve by hand.
      const nameToUid = new Map<string, string>();
      const firstNameCounts = new Map<string, number>();
      (freshEmployees || []).forEach((e: any) => {
        const full = e.full_name.trim().toLowerCase();
        nameToUid.set(full, e.id);
        const first = full.split(/\s+/)[0];
        firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1);
      });
      (freshEmployees || []).forEach((e: any) => {
        const full = e.full_name.trim().toLowerCase();
        const first = full.split(/\s+/)[0];
        if (firstNameCounts.get(first) === 1 && !nameToUid.has(first)) {
          nameToUid.set(first, e.id);
        }
      });

      // One row per batch, for retry-idempotency - see migration 45's
      // unique index on (source_batch_id, source_sheet, source_row_number).
      const { data: batch, error: batchErr } = await supabase
        .from("sales_import_batches")
        .insert({
          imported_by: profile.uid,
          source_file: file.name,
          import_mode: "new_leads",
          source_row_count: parsed.length + skippedNoName,
        })
        .select("id")
        .single();
      if (batchErr || !batch) throw batchErr || new Error("Failed to create import batch");

      let infoDupCount = 0;
      const unmatchedNameCounts = new Map<string, number>();
      const toInsert = parsed.map((row) => {
        const np = normalizePhoneForCompare(row.mobile);
        const ne = normalizeEmailForCompare(row.email);
        if ((np && existingPhones.has(np)) || (ne && existingEmails.has(ne))) infoDupCount++;

        let assignedUid: string | null = null;
        let originalAssignedName: string | undefined;
        if (row.assigned_to_name) {
          const key = row.assigned_to_name.trim().toLowerCase();
          assignedUid = nameToUid.get(key) || null;
          if (!assignedUid) {
            unmatchedNameCounts.set(row.assigned_to_name, (unmatchedNameCounts.get(row.assigned_to_name) || 0) + 1);
            originalAssignedName = row.assigned_to_name;
          }
        }

        return {
          name: row.name,
          mobile: row.mobile || null,
          email: row.email || null,
          linkedin_url: row.linkedin_url || null,
          visa: row.visa,
          status: row.status,
          country: row.country,
          remarks: row.remarks,
          entry_date: row.entry_date,
          assigned_to: assignedUid,
          created_by: profile.uid,
          custom_fields: originalAssignedName ? { ...row.custom_fields, original_assigned_to: originalAssignedName } : row.custom_fields,
          source_batch_id: batch.id,
          source_sheet: sheetName,
          source_row_number: row.source_row_number,
        };
      });

      if (newCustomColumns.length > 0) {
        const existingKeys = new Set(customColumns.filter((c) => c.owner_id === profile.uid).map((c) => c.column_key));
        const toRegister = newCustomColumns.filter((c) => !existingKeys.has(c.key));
        if (toRegister.length > 0) {
          await supabase.from("sales_custom_columns").insert(
            toRegister.map((c, i) => ({ owner_id: profile.uid, column_key: c.key, column_label: c.label, column_order: customColumns.length + i }))
          );
        }
      }

      const CHUNK = 500;
      let insertedCount = 0;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const { data: chunkResult, error } = await supabase.from("sales_leads").insert(toInsert.slice(i, i + CHUNK)).select("id");
        if (error) throw error;
        insertedCount += chunkResult?.length || 0;
      }

      await supabase
        .from("sales_import_batches")
        .update({ successful_row_count: insertedCount, failed_row_count: toInsert.length - insertedCount })
        .eq("id", batch.id);

      const assignedCount = toInsert.filter((r) => r.assigned_to).length;
      let summary = `Imported ${insertedCount} lead(s) (${assignedCount} auto-assigned). Skipped ${skippedNoName} row(s) with no name.`;
      if (infoDupCount > 0) summary += ` ${infoDupCount} look like existing candidates — kept as separate entries, not merged or skipped.`;
      if (unmatchedNameCounts.size > 0) {
        const breakdown = Array.from(unmatchedNameCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, n]) => `"${name}" (${n})`)
          .join(", ");
        summary += ` ${Array.from(unmatchedNameCounts.values()).reduce((a, b) => a + b, 0)} row(s) had an Assigned To name that didn't match any active Sales-department employee — left unassigned, original name preserved: ${breakdown}.`;
      }
      setImportSummary(summary);
      toast.success(`Imported ${insertedCount} lead(s)`);
      await fetchPage(true);
      loadStats();
    } catch (err: any) {
      toast.error("Import failed: " + (err?.message || "unknown error"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return d;
    }
  };

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

  const avatarPalette = ["bg-blue-100 text-blue-700", "bg-purple-100 text-purple-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
  const avatarColor = (name: string) => avatarPalette[name.charCodeAt(0) % avatarPalette.length];

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { key: "all" as const, label: "Total Leads", value: stats.total, icon: Users, accent: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-600" },
          { key: "assigned" as const, label: "Assigned", value: stats.assigned, icon: UserCheck, accent: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-600" },
          { key: "unassigned" as const, label: "Unassigned", value: stats.unassigned, icon: UserX, accent: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-600" },
        ].map((tile) => {
          const Icon = tile.icon;
          const active = assignmentFilter === tile.key;
          return (
            <button
              key={tile.key}
              onClick={() => setAssignmentFilter(tile.key)}
              className={`text-left bg-white rounded-2xl p-4 border shadow-sm flex items-center justify-between transition-all hover:-translate-y-0.5 hover:shadow-md relative overflow-hidden ${active ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-100"}`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${tile.accent}`} />
              <div className="pl-2">
                <p className="text-xs font-medium text-slate-500">{tile.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{tile.value.toLocaleString()}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tile.bg}`}>
                <Icon className={`h-5 w-5 ${tile.text}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, mobile..."
            className="w-full pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm">
          {(["all", "unassigned", "assigned"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setAssignmentFilter(f)}
              className={`px-3.5 py-2 font-medium capitalize transition-colors ${assignmentFilter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" id="sales-master-import-input" />
        <label
          htmlFor="sales-master-import-input"
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${importing ? "opacity-60 pointer-events-none bg-slate-100 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"}`}
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? "Importing..." : "Import XL"}
        </label>
        <button
          onClick={() => setIsAddingNew((v) => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${isAddingNew ? "bg-slate-200 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800"}`}
        >
          <FilePlus2 className="h-4 w-4" /> {isAddingNew ? "Cancel Adding" : "Add Data"}
        </button>
      </div>

      {/* Date filters + sort */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Entry Date</span>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <input type="date" value={entryDateFrom} onChange={(e) => setEntryDateFrom(e.target.value)} className="bg-transparent text-sm text-slate-600 focus:outline-none" />
            <span className="text-slate-300 text-sm">–</span>
            <input type="date" value={entryDateTo} onChange={(e) => setEntryDateTo(e.target.value)} className="bg-transparent text-sm text-slate-600 focus:outline-none" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Status Date</span>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <input type="date" value={statusDateFrom} onChange={(e) => setStatusDateFrom(e.target.value)} className="bg-transparent text-sm text-slate-600 focus:outline-none" />
            <span className="text-slate-300 text-sm">–</span>
            <input type="date" value={statusDateTo} onChange={(e) => setStatusDateTo(e.target.value)} className="bg-transparent text-sm text-slate-600 focus:outline-none" />
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={dateSortField}
            onChange={(e) => setDateSortField(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="entry_date">Sort: Entry Date</option>
            <option value="status_updated_work_date">Sort: Last Status Date</option>
          </select>
          <select
            value={dateSortDir}
            onChange={(e) => setDateSortDir(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
      </div>

      {importSummary && (
        <div className="text-sm text-slate-600 bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
          <span>{importSummary}</span>
          <button onClick={() => setImportSummary(null)} className="shrink-0"><X className="h-4 w-4 text-slate-400 hover:text-slate-600" /></button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-900 text-white rounded-xl px-4 py-3 shadow-lg sticky top-2 z-20">
          <span className="text-sm font-semibold">{selectedIds.size} selected</span>
          <span className="text-xs text-slate-400 hidden sm:inline">Tip: click a checkbox, then press ↓ / ↑ to extend the selection</span>
          <div className="flex-1" />
          <select
            disabled={bulkAssigning}
            value=""
            onChange={(e) => e.target.value && handleBulkAssign(e.target.value)}
            className="bg-white text-slate-800 text-sm font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer disabled:opacity-60"
          >
            <option value="" disabled>{bulkAssigning ? "Assigning..." : "Assign to..."}</option>
            {employees.map((emp) => (
              <option key={emp.uid} value={emp.uid}>{emp.fullName}</option>
            ))}
          </select>
          <button
            onClick={() => { setSelectedIds(new Set()); anchorIndexRef.current = null; cursorIndexRef.current = null; }}
            className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 sticky top-0 z-10">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-3.5 w-10">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                  onChange={toggleSelectAllOnPage}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                  title="Select all on this page"
                />
              </th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Entry Date</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Last Status Date</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Name</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Contact</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Email</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">LinkedIn</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[160px]">Status</th>
              {customColumns.map((c) => (
                <th key={c.id} className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{c.column_label}</th>
              ))}
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Assigned To</th>
            </tr>
          </thead>
          <tbody>
            {isAddingNew && (
              <>
                {newRows.map((row, index) => (
                  <tr key={row.id} className="bg-blue-50/30 border-b border-blue-100">
                    <td className="px-4 py-2" />
                    <td className="px-5 py-2 text-xs text-slate-400 whitespace-nowrap">Today</td>
                    <td className="px-5 py-2 text-xs text-slate-400 whitespace-nowrap">—</td>
                    <td className="px-4 py-2">
                      <input
                        autoFocus={index === 0}
                        placeholder="Name"
                        value={row.name}
                        onChange={(e) => updateNewRow(row.id, "name", e.target.value)}
                        className="w-full min-w-[140px] bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        placeholder="Contact"
                        value={row.mobile}
                        onChange={(e) => updateNewRow(row.id, "mobile", e.target.value)}
                        className="w-full min-w-[130px] bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        placeholder="Email"
                        value={row.email}
                        onChange={(e) => updateNewRow(row.id, "email", e.target.value)}
                        className="w-full min-w-[180px] bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        placeholder="LinkedIn URL"
                        value={row.linkedin_url}
                        onChange={(e) => updateNewRow(row.id, "linkedin_url", e.target.value)}
                        className="w-full min-w-[160px] bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-300 text-xs">—</td>
                    {customColumns.map((c) => (
                      <td key={c.id} className="px-4 py-2 text-slate-300 text-xs">—</td>
                    ))}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <select
                          value={row.assigned_to}
                          onChange={(e) => updateNewRow(row.id, "assigned_to", e.target.value)}
                          className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {employees.map((emp) => (
                            <option key={emp.uid} value={emp.uid}>{emp.fullName}</option>
                          ))}
                        </select>
                        {newRows.length > 1 && (
                          <button onClick={() => setNewRows(newRows.filter((r) => r.id !== row.id))} title="Remove row" className="shrink-0 text-slate-300 hover:text-red-500 p-1">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50/30 border-b border-blue-100">
                  <td colSpan={20} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setNewRows([...newRows, createEmptyMasterRow()])}
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-100/60 transition-colors"
                      >
                        <Plus className="h-4 w-4" /> Add another row
                      </button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setIsAddingNew(false); setNewRows([createEmptyMasterRow()]); }} className="text-sm text-slate-500 hover:text-slate-700 font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveNewRows}
                          disabled={savingRows}
                          className="inline-flex items-center gap-2 text-sm text-white bg-slate-900 hover:bg-slate-800 font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {savingRows ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {savingRows ? "Saving..." : "Save Entries"}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </>
            )}
            {loading ? (
              <tr>
                <td colSpan={20} className="px-5 py-16 text-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading leads...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-5 py-16 text-center text-slate-400">
                  <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  No leads found{searchQuery || entryDateFrom || entryDateTo ? " for these filters" : ""}.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors ${selectedIds.has(row.id) ? "bg-blue-50/50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => handleRowCheckboxClick(index, row.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-500">{formatDate(row.entry_date)}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-400">{formatDate(row.status_updated_work_date)}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${avatarColor(row.name)}`}>{initials(row.name)}</div>
                      <span className="font-medium text-slate-800">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-600">{row.mobile || "—"}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-600">{row.email || "—"}</td>
                  <td className="px-5 py-3 max-w-[220px] truncate">
                    {row.linkedin_url ? (
                      <a href={row.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{row.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.status || ""}
                      onChange={(e) => updateRowField(row.id, "status", e.target.value || null)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer ${row.status ? statusColors[row.status] : "bg-slate-100 text-slate-500"}`}
                    >
                      <option value="">Not contacted</option>
                      {SALES_LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  {customColumns.map((c) => (
                    <td key={c.id} className="px-5 py-3 text-slate-500">{row.custom_fields?.[c.column_key] || "—"}</td>
                  ))}
                  <td className="px-5 py-3">
                    <select
                      value={row.assigned_to || ""}
                      onChange={(e) => handleAssign(row, e.target.value)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer ${row.assigned_to ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      <option value="">Unassigned</option>
                      {employees.map((emp) => (
                        <option key={emp.uid} value={emp.uid}>{emp.fullName}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-500 border-t border-slate-100 px-5 py-3.5 bg-slate-50/50">
          <span>Showing <span className="font-semibold text-slate-700">{rows.length}</span> of <span className="font-semibold text-slate-700">{totalCount.toLocaleString()}</span></span>
          {rows.length < totalCount && (
            <button onClick={() => fetchPage(false)} disabled={loadingMore} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-medium transition-colors">
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
