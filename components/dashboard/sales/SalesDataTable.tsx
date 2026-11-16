"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";
import { Search, X, FileSpreadsheet, Plus, Loader2, Inbox, ExternalLink, Phone, CalendarCheck, TrendingUp, ArrowUpDown, FilePlus2, Save } from "lucide-react";
import { SALES_LEAD_STATUSES, SALES_VISA_OPTIONS, normalizePhoneForCompare, normalizeEmailForCompare } from "@/lib/salesLeadsImport";
import GenerateSalesReportModal from "./GenerateSalesReportModal";

const PAGE_SIZE = 100;

function escapeLike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "");
}
function buildSearchPattern(str: string): string {
  const escaped = escapeLike(str).replace(/[\s\-_]+/g, "%");
  return `%${escaped}%`;
}

function isPrivilegedProfile(profile: any): boolean {
  if (!profile) return false;
  if (["Admin", "HR", "OPS_HR"].includes(profile.role)) return true;
  if (profile.role === "SALES" && (profile.designation === "Team-Lead" || profile.designation === "Manager" || profile.jobRole === "Team-Lead" || profile.jobRole === "Manager")) {
    return true;
  }
  return false;
}

// Bulk Excel import still stays Team-Lead/Manager/Admin/HR-only (Master
// Data). A regular employee may manually add ONE self-sourced lead at a
// time here though (e.g. a referral they personally found) - always
// auto-assigned to themselves, never left unassigned or handed to someone
// else (see migration 48 / sales_leads_insert's RLS).
export default function SalesDataTable() {
  const { profile } = useAuth();
  const isPrivileged = isPrivilegedProfile(profile);

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
  const [dateSortField, setDateSortField] = useState<"assigned_at" | "entry_date" | "status_updated_work_date">("assigned_at");
  const [dateSortDir, setDateSortDir] = useState<"asc" | "desc">("desc");
  const [visaFilter, setVisaFilter] = useState(""); // "" = all, "__none__" = not specified, else exact visa value
  const [statusFilter, setStatusFilter] = useState(""); // "" = all, "__none__" = not contacted, else exact status value

  const [customColumns, setCustomColumns] = useState<any[]>([]);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [othersEditingIds, setOthersEditingIds] = useState<Set<string>>(new Set());
  const VISA_KNOWN_LIST = SALES_VISA_OPTIONS.slice(0, -1); // fixed 9, excluding the "Others" sentinel

  const [stats, setStats] = useState({ total: 0, interested: 0, meetingScheduled: 0, needsFollowUp: 0 });

  // ── Manual "Add Data" — regular employees only, one self-sourced lead at a time ──
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRow, setNewRow] = useState({ name: "", mobile: "", email: "", linkedin_url: "" });
  const [savingNewRow, setSavingNewRow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadStats = useCallback(async () => {
    if (!profile?.uid) return;
    const supabase = createClient();
    const uid = profile.uid;

    const countFor = async (status?: string) => {
      let q = supabase.from("sales_leads").select("id", { count: "exact" }).limit(1);
      if (!isPrivileged) q = q.eq("assigned_to", uid);
      if (status) q = q.eq("status", status);
      const { count, error } = await q;
      if (error) console.error("Failed to load sales stats:", error);
      return count ?? 0;
    };

    const [total, interested, meeting, followUp] = await Promise.all([
      countFor(),
      countFor("Interested"),
      countFor("Meeting scheduled"),
      countFor("Follow up requested"),
    ]);
    setStats({ total, interested, meetingScheduled: meeting, needsFollowUp: followUp });
  }, [profile?.uid, isPrivileged]);

  const loadCustomColumns = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("sales_custom_columns").select("*").order("column_order", { ascending: true });
    setCustomColumns(data || []);
  }, []);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!profile?.uid) return;
      reset ? setLoading(true) : setLoadingMore(true);
      const supabase = createClient();
      let query = supabase
        .from("sales_leads")
        .select(isPrivileged ? "*, assigned_profile:profiles!sales_leads_assigned_to_fkey(full_name)" : "*", { count: "exact" });

      if (!isPrivileged) {
        query = query.eq("assigned_to", profile.uid);
      }
      if (debouncedSearch) {
        const pattern = buildSearchPattern(debouncedSearch);
        query = query.or(`name.ilike.${pattern},email.ilike.${pattern},mobile.ilike.${pattern}`);
      }
      if (entryDateFrom) query = query.gte("entry_date", entryDateFrom);
      if (entryDateTo) query = query.lte("entry_date", entryDateTo);
      if (statusDateFrom) query = query.gte("status_updated_work_date", statusDateFrom);
      if (statusDateTo) query = query.lte("status_updated_work_date", statusDateTo);
      if (visaFilter === "__none__") query = query.is("visa", null);
      else if (visaFilter) query = query.eq("visa", visaFilter);
      if (statusFilter === "__none__") query = query.is("status", null);
      else if (statusFilter) query = query.eq("status", statusFilter);

      query = query
        .order(dateSortField, { ascending: dateSortDir === "asc", nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });

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
    [profile?.uid, isPrivileged, debouncedSearch, entryDateFrom, entryDateTo, statusDateFrom, statusDateTo, visaFilter, statusFilter, dateSortField, dateSortDir, offset]
  );

  useEffect(() => {
    fetchPage(true);
    loadCustomColumns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid, isPrivileged, debouncedSearch, entryDateFrom, entryDateTo, statusDateFrom, statusDateTo, visaFilter, statusFilter, dateSortField, dateSortDir]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const updateRowField = async (id: string, field: string, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    const supabase = createClient();
    const { error } = await supabase.from("sales_leads").update({ [field]: value }).eq("id", id);
    if (error) toast.error("Failed to save: " + error.message);
    else if (field === "status") {
      loadStats();
      fetchPage(true); // status_updated_work_date changed server-side - refetch to show it
    }
  };

  const updateCustomField = async (id: string, key: string, value: string) => {
    const row = rows.find((r) => r.id === id);
    const merged = { ...(row?.custom_fields || {}), [key]: value };
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, custom_fields: merged } : r)));
    const supabase = createClient();
    const { error } = await supabase.from("sales_leads").update({ custom_fields: merged }).eq("id", id);
    if (error) toast.error("Failed to save: " + error.message);
  };

  // Informational duplicate check only (never blocking, matching Master
  // Data's own import/manual-add behavior) - RLS already limits what this
  // query can see to the employee's own existing leads, which is exactly
  // the right scope to de-dup against for a self-sourced lead.
  const handleSaveNewRow = async () => {
    const name = newRow.name.trim();
    if (!name) {
      toast.error("Please enter a name");
      return;
    }
    if (!profile?.uid) return;
    setSavingNewRow(true);
    try {
      const supabase = createClient();
      const np = normalizePhoneForCompare(newRow.mobile);
      const ne = normalizeEmailForCompare(newRow.email);
      let isDup = false;
      if (np || ne) {
        const { data: existing } = await supabase.from("sales_leads").select("mobile,email");
        isDup = (existing || []).some(
          (r: any) => (np && normalizePhoneForCompare(r.mobile) === np) || (ne && normalizeEmailForCompare(r.email) === ne)
        );
      }
      const { error } = await supabase.from("sales_leads").insert({
        name,
        mobile: newRow.mobile.trim() || null,
        email: newRow.email.trim() || null,
        linkedin_url: newRow.linkedin_url.trim() || null,
        visa: null,
        status: null,
        country: null,
        remarks: null,
        entry_date: new Date().toISOString().split("T")[0],
        assigned_to: profile.uid,
        created_by: profile.uid,
        custom_fields: {},
      });
      if (error) throw error;
      toast.success(`Lead added${isDup ? " (looks like an existing candidate - kept as a separate entry)" : ""}`);
      setNewRow({ name: "", mobile: "", email: "", linkedin_url: "" });
      setIsAddingNew(false);
      await fetchPage(true);
      loadStats();
    } catch (err: any) {
      toast.error("Failed to save: " + (err?.message || "unknown error"));
    } finally {
      setSavingNewRow(false);
    }
  };

  const handleAddColumn = async () => {
    const label = newColumnLabel.trim();
    if (!label || !profile?.uid) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
    if (customColumns.some((c) => c.column_key === key && c.owner_id === profile.uid)) {
      toast.error("You already have a column with that name.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("sales_custom_columns").insert({
      owner_id: profile.uid,
      column_key: key,
      column_label: label,
      column_order: customColumns.length,
    });
    if (error) {
      toast.error("Failed to add column: " + error.message);
      return;
    }
    setNewColumnLabel("");
    setAddingColumn(false);
    loadCustomColumns();
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return d;
    }
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return d;
    }
  };

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const avatarPalette = ["bg-blue-100 text-blue-700", "bg-purple-100 text-purple-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
  const avatarColor = (name: string) => avatarPalette[name.charCodeAt(0) % avatarPalette.length];

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

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats.total, icon: Phone, bg: "bg-blue-50", text: "text-blue-600", accent: "bg-blue-500" },
          { label: "Interested", value: stats.interested, icon: TrendingUp, bg: "bg-emerald-50", text: "text-emerald-600", accent: "bg-emerald-500" },
          { label: "Meetings Scheduled", value: stats.meetingScheduled, icon: CalendarCheck, bg: "bg-blue-50", text: "text-blue-600", accent: "bg-blue-500" },
          { label: "Follow-ups Needed", value: stats.needsFollowUp, icon: Search, bg: "bg-amber-50", text: "text-amber-600", accent: "bg-amber-500" },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${tile.accent}`} />
              <div className="pl-2">
                <p className="text-xs font-medium text-slate-500">{tile.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{tile.value.toLocaleString()}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tile.bg} shrink-0`}>
                <Icon className={`h-4.5 w-4.5 ${tile.text}`} />
              </div>
            </div>
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
        <div className="flex-1" />
        {!isPrivileged && (
          <button
            onClick={() => setIsAddingNew((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${isAddingNew ? "bg-slate-200 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800"}`}
          >
            <FilePlus2 className="h-4 w-4" /> {isAddingNew ? "Cancel Adding" : "Add Data"}
          </button>
        )}
        <button onClick={() => setReportModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors">
          <FileSpreadsheet className="h-4 w-4" /> Generate Report
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Visa</span>
          <select
            value={visaFilter}
            onChange={(e) => setVisaFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="">All</option>
            <option value="__none__">Not specified</option>
            {SALES_VISA_OPTIONS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="">All</option>
            <option value="__none__">Not contacted</option>
            {SALES_LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {(entryDateFrom || entryDateTo || statusDateFrom || statusDateTo || visaFilter || statusFilter) && (
          <button onClick={() => { setEntryDateFrom(""); setEntryDateTo(""); setStatusDateFrom(""); setStatusDateTo(""); setVisaFilter(""); setStatusFilter(""); }} title="Clear filters">
            <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
          </button>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={dateSortField}
            onChange={(e) => setDateSortField(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="assigned_at">Sort: Assigned Date</option>
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

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 sticky top-0 z-10">
            <tr className="text-left text-slate-500">
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Assigned On</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Entry Date</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Last Status Date</th>
              {isPrivileged && <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Owner</th>}
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Name</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[200px]">Email</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[150px]">Mobile</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[140px]">Visa</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">LinkedIn</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[160px]">Status</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[120px]">Country</th>
              <th className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[220px]">Remarks</th>
              {customColumns.map((c) => (
                <th key={c.id} className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{c.column_label}</th>
              ))}
              <th className="px-2 py-3.5">
                {addingColumn ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={newColumnLabel}
                      onChange={(e) => setNewColumnLabel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                      placeholder="Column name"
                      className="px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-lg w-28 normal-case font-normal focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                    <button onClick={handleAddColumn} className="text-xs text-blue-600 font-semibold normal-case">Add</button>
                    <button onClick={() => setAddingColumn(false)}><X className="h-3 w-3 text-slate-400" /></button>
                  </div>
                ) : (
                  <button onClick={() => setAddingColumn(true)} title="Add a custom column (only you will see it)" className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {isAddingNew && !isPrivileged && (
              <tr className="bg-blue-50/30 border-b border-blue-100">
                <td className="px-5 py-2 text-xs text-slate-400 whitespace-nowrap">—</td>
                <td className="px-5 py-2 text-xs text-slate-400 whitespace-nowrap">Today</td>
                <td className="px-5 py-2 text-xs text-slate-400 whitespace-nowrap">—</td>
                <td className="px-4 py-2">
                  <input
                    autoFocus
                    placeholder="Name"
                    value={newRow.name}
                    onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveNewRow()}
                    className="w-full min-w-[140px] bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    placeholder="Email"
                    value={newRow.email}
                    onChange={(e) => setNewRow((r) => ({ ...r, email: e.target.value }))}
                    className="w-full min-w-[180px] bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    placeholder="Mobile"
                    value={newRow.mobile}
                    onChange={(e) => setNewRow((r) => ({ ...r, mobile: e.target.value }))}
                    className="w-full min-w-[130px] bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </td>
                <td className="px-4 py-2 text-slate-300 text-xs">—</td>
                <td className="px-4 py-2">
                  <input
                    placeholder="LinkedIn URL"
                    value={newRow.linkedin_url}
                    onChange={(e) => setNewRow((r) => ({ ...r, linkedin_url: e.target.value }))}
                    className="w-full min-w-[160px] bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </td>
                <td className="px-4 py-2 text-slate-300 text-xs">—</td>
                <td className="px-4 py-2 text-slate-300 text-xs">—</td>
                <td className="px-4 py-2 text-slate-300 text-xs">—</td>
                {customColumns.map((c) => (
                  <td key={c.id} className="px-4 py-2 text-slate-300 text-xs">—</td>
                ))}
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={handleSaveNewRow} disabled={savingNewRow} title="Save" className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg p-1.5 transition-colors disabled:opacity-50">
                      {savingNewRow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button onClick={() => { setIsAddingNew(false); setNewRow({ name: "", mobile: "", email: "", linkedin_url: "" }); }} title="Cancel" className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
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
                  No leads yet{searchQuery || entryDateFrom || entryDateTo || visaFilter || statusFilter ? " for these filters" : " — wait for leads to be assigned by your Team-Lead/Manager"}.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isCustomVisa = !!row.visa && !VISA_KNOWN_LIST.includes(row.visa);
                const showVisaTextInput = othersEditingIds.has(row.id) || isCustomVisa;
                return (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-500">{formatDateTime(row.assigned_at)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-500">{formatDate(row.entry_date)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-400">{formatDate(row.status_updated_work_date)}</td>
                    {isPrivileged && (
                      <td className="px-5 py-3 whitespace-nowrap">
                        {row.assigned_profile?.full_name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">{row.assigned_profile.full_name}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">Unassigned</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${avatarColor(row.name)}`}>{initials(row.name)}</div>
                        <span className="font-medium text-slate-800">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <input defaultValue={row.email || ""} placeholder="—" onBlur={(e) => e.target.value !== row.email && updateRowField(row.id, "email", e.target.value)} className="w-full min-w-[180px] bg-slate-50/70 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white rounded-lg px-2 py-1.5 hover:border-slate-300 transition-colors" />
                    </td>
                    <td className="px-4 py-2">
                      <input defaultValue={row.mobile || ""} placeholder="—" onBlur={(e) => e.target.value !== row.mobile && updateRowField(row.id, "mobile", e.target.value)} className="w-full min-w-[130px] bg-slate-50/70 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white rounded-lg px-2 py-1.5 hover:border-slate-300 transition-colors" />
                    </td>
                    <td className="px-4 py-2">
                      {showVisaTextInput ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus={othersEditingIds.has(row.id)}
                            defaultValue={isCustomVisa ? row.visa : ""}
                            placeholder="Specify visa"
                            onBlur={(e) => e.target.value !== row.visa && updateRowField(row.id, "visa", e.target.value)}
                            className="w-24 bg-transparent border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          <button
                            title="Back to dropdown"
                            onClick={() => {
                              setOthersEditingIds((prev) => { const next = new Set(prev); next.delete(row.id); return next; });
                              updateRowField(row.id, "visa", "");
                            }}
                          >
                            <X className="h-3 w-3 text-slate-400" />
                          </button>
                        </div>
                      ) : (
                        <select
                          value={row.visa || ""}
                          onChange={(e) => {
                            if (e.target.value === "Others") {
                              setOthersEditingIds((prev) => new Set(prev).add(row.id));
                            } else {
                              updateRowField(row.id, "visa", e.target.value);
                            }
                          }}
                          className="bg-slate-50/70 border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 hover:border-slate-300 transition-colors cursor-pointer"
                        >
                          <option value="" className="text-slate-800">—</option>
                          {SALES_VISA_OPTIONS.map((v) => (
                            <option key={v} value={v} className="text-slate-800">{v}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-2 max-w-[200px] truncate">
                      {row.linkedin_url ? (
                        <a href={row.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block">{row.linkedin_url}</a>
                      ) : (
                        <input defaultValue={""} placeholder="Add URL" onBlur={(e) => e.target.value && updateRowField(row.id, "linkedin_url", e.target.value)} className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white rounded-lg px-2 py-1.5 hover:border-slate-300 transition-colors" />
                      )}
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
                    <td className="px-4 py-2">
                      <input defaultValue={row.country || ""} placeholder="—" onBlur={(e) => e.target.value !== row.country && updateRowField(row.id, "country", e.target.value)} className="w-full min-w-[100px] bg-slate-50/70 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white rounded-lg px-2 py-1.5 hover:border-slate-300 transition-colors" />
                    </td>
                    <td className="px-4 py-2 min-w-[220px]">
                      <input defaultValue={row.remarks || ""} placeholder="Add a remark..." onBlur={(e) => e.target.value !== row.remarks && updateRowField(row.id, "remarks", e.target.value)} className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white rounded-lg px-2 py-1.5 hover:border-slate-300 transition-colors" />
                    </td>
                    {customColumns.map((c) => (
                      <td key={c.id} className="px-4 py-2">
                        {c.owner_id === row.assigned_to || c.owner_id === row.created_by ? (
                          <input
                            defaultValue={row.custom_fields?.[c.column_key] || ""}
                            placeholder="—"
                            onBlur={(e) => e.target.value !== (row.custom_fields?.[c.column_key] || "") && updateCustomField(row.id, c.column_key, e.target.value)}
                            className="w-full min-w-[100px] bg-slate-50/70 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white rounded-lg px-2 py-1.5 hover:border-slate-300 transition-colors"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                    <td />
                  </tr>
                );
              })
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

      <GenerateSalesReportModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />
    </div>
  );
}
