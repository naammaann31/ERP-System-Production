"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Contact, Search, Mail, X, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import LinkedInIcon from "@/components/ui/LinkedInIcon";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

const PAGE_SIZE = 50;

interface TeamMember {
    uid: string;
    name: string;
    email: string;
    employeeId: string;
    department: string;
    jobRole: string;
    designation: string;
    linkedinUrl: string | null;
    avatarUrl: string | null;
    avatarThumbUrl: string | null;
}

const getDepartmentColor = (department: string) => {
    switch (department) {
        case "Marketing": case "MARKETING": return "info";
        case "Sales": case "SALES": return "success";
        case "HR": return "warning";
        case "IT": return "default";
        case "Admin": return "destructive";
        default: return "secondary";
    }
};

/**
 * Local copy, not shared — same deliberate convention as Marketing/
 * Candidates/Interview & Screening, whose search helpers are each
 * independent rather than a shared abstraction.
 */
function buildSearchPattern(str: string): string {
    const escaped = str
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/,/g, "")
        .replace(/[\s\-_]+/g, "%");
    return `%${escaped}%`;
}

export default function VectraTeamPage() {
    const { profile } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState("All");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [departments, setDepartments] = useState<string[]>(["All"]);

    // Click-to-enlarge, WhatsApp-style. No extra network request: the
    // thumbnail and the full photo are the same file at the same URL
    // (avatars aren't resized server-side), so the browser already has it
    // cached from rendering the row's thumbnail — this just redisplays
    // that same cached image larger, zero added egress.
    useEffect(() => {
        if (!lightbox) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setLightbox(null);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [lightbox]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Department options come from the live roles actually in use, not a
    // hardcoded list — fetched once (just the `role` column, every row,
    // no range/pagination needed since it's one narrow text column) and
    // reduced to the same display labels the table already uses (OPS_HR
    // folded into "HR"), so the filter never drifts from what's real.
    useEffect(() => {
        if (!profile) return;
        let isMounted = true;
        const supabase = createClient();
        supabase
            .from("profiles")
            .select("role")
            .then(({ data, error: err }) => {
                if (!isMounted || err || !data) return;
                const labels = new Set<string>();
                data.forEach((row: any) => {
                    labels.add(row.role === "OPS_HR" ? "HR" : (row.role || "Employee"));
                });
                setDepartments(["All", ...Array.from(labels).sort()]);
            });
        return () => {
            isMounted = false;
        };
    }, [profile]);

    const buildBaseQuery = useCallback(
        (supabase: ReturnType<typeof createClient>) => {
            let query = supabase
                .from("profiles")
                .select("id, full_name, email, employee_id, role, job_role, designation, linkedin_url, avatar_url, avatar_thumb_url", { count: "exact" })
                .order("full_name", { ascending: true, nullsFirst: false });

            if (debouncedSearch) {
                const pattern = buildSearchPattern(debouncedSearch.toLowerCase());
                query = query.or(
                    [
                        `full_name.ilike.${pattern}`,
                        `email.ilike.${pattern}`,
                        `employee_id.ilike.${pattern}`,
                        `job_role.ilike.${pattern}`,
                        `designation.ilike.${pattern}`,
                    ].join(",")
                );
            }

            if (selectedDepartment !== "All") {
                // "HR" in the UI covers both the HR and OPS_HR roles, same
                // folding mapRow() already does for display.
                if (selectedDepartment === "HR") {
                    query = query.in("role", ["HR", "OPS_HR"]);
                } else {
                    query = query.eq("role", selectedDepartment);
                }
            }

            return query;
        },
        [debouncedSearch, selectedDepartment]
    );

    const mapRow = (row: any): TeamMember => ({
        uid: row.id,
        name: row.full_name || "Unnamed",
        email: row.email || "",
        employeeId: row.employee_id || "N/A",
        department: row.role === "OPS_HR" ? "HR" : (row.role || "Employee"),
        jobRole: row.job_role || "N/A",
        designation: row.designation || "Employee",
        linkedinUrl: row.linkedin_url,
        avatarUrl: row.avatar_url,
        avatarThumbUrl: row.avatar_thumb_url,
    });

    const fetchPage = useCallback(
        async (reset: boolean, silent: boolean = false) => {
            if (!profile) return;
            const currentOffset = reset ? 0 : offset;

            // Non-silent only for user-driven loads (initial load, search
            // change, "Load More") — a silent realtime refresh must never
            // flip the loading flag, same fix pattern as Candidates.
            if (!silent) {
                if (reset) setLoading(true);
                else setLoadingMore(true);
            }

            try {
                const supabase = createClient();
                const { data, count, error: err } = await buildBaseQuery(supabase)
                    .range(currentOffset, currentOffset + PAGE_SIZE - 1);

                if (err) throw err;

                setError(null);
                const mapped = (data || []).map(mapRow);
                if (reset) {
                    setMembers(mapped);
                    setOffset(PAGE_SIZE);
                } else {
                    setMembers((prev) => [...prev, ...mapped]);
                    setOffset((prev) => prev + PAGE_SIZE);
                }
                setTotalCount(count ?? 0);
            } catch (err: any) {
                console.error("Load Vectra Team failed:", err?.message, err);
                setError("Could not load the team directory.");
            } finally {
                if (!silent) {
                    setLoading(false);
                    setLoadingMore(false);
                }
            }
        },
        [buildBaseQuery, offset, profile]
    );

    // Combined on purpose: the realtime channel below closes over fetchPage,
    // which itself depends on debouncedSearch/selectedDepartment (via
    // buildBaseQuery) — if the channel were set up in a separate effect
    // keyed only on [profile], it would keep calling a stale fetchPage
    // holding the old filters from whenever the channel was first
    // subscribed. Re-subscribing on every search/filter change (same
    // pattern as Candidates) keeps it current.
    useEffect(() => {
        if (!profile) return;
        let isMounted = true;

        fetchPage(true);

        const supabase = createClient();
        let insertTimeoutId: NodeJS.Timeout;
        let patchTimeoutId: NodeJS.Timeout;
        const pendingUpdatedIds = new Set<string>();
        const pendingDeletedIds = new Set<string>();

        // UPDATE/DELETE: a targeted patch instead of re-fetching page 1 — one
        // person's profile changing (e.g. uploading a photo) shouldn't
        // re-download the whole page for every other open session. INSERT
        // stays on the debounced full reset below: new employees are created
        // one at a time (no bulk-insert path for profiles, unlike Marketing/
        // Candidates' Excel imports), and — unlike a known-id UPDATE — a
        // brand-new row's correct position in the alphabetically-sorted,
        // only-partially-loaded page can't be determined from the row alone.
        const flushPatches = async () => {
            if (!isMounted) return;
            const updatedIds = Array.from(pendingUpdatedIds);
            const deletedIds = Array.from(pendingDeletedIds);
            pendingUpdatedIds.clear();
            pendingDeletedIds.clear();
            if (updatedIds.length === 0 && deletedIds.length === 0) return;

            let updatedRowsMap = new Map<string, TeamMember>();
            if (updatedIds.length > 0) {
                const { data, error: err } = await buildBaseQuery(supabase).in("id", updatedIds);
                if (!isMounted) return;
                if (err) {
                    console.error("Realtime patch fetch failed:", err.message, err);
                } else {
                    updatedRowsMap = new Map((data || []).map((row: any) => [row.id, mapRow(row)]));
                }
            }

            setMembers((prev) => {
                let next = prev.filter((m) => !deletedIds.includes(m.uid));
                next = next
                    .map((m) => (updatedIds.includes(m.uid) ? (updatedRowsMap.get(m.uid) ?? null) : m))
                    .filter((m): m is TeamMember => m !== null);
                // An id that matched the filter but wasn't already loaded —
                // e.g. a role change just brought it into the active
                // department filter. No reliable alphabetical slot to insert
                // it at without knowing the full ordering, so (same choice
                // lib/leave.ts's listenToQuery already makes) it goes to the
                // top; a later search/filter change naturally re-sorts it.
                const existingIds = new Set(next.map((m) => m.uid));
                const newlyMatching = updatedIds
                    .filter((id) => updatedRowsMap.has(id) && !existingIds.has(id))
                    .map((id) => updatedRowsMap.get(id)!);
                return [...newlyMatching, ...next];
            });

            // Refresh the total count once per flush — cheap (1 row, exact
            // count), avoids re-implementing the filter-matching logic in JS
            // just to decide whether the total went up or down.
            try {
                const { count } = await buildBaseQuery(supabase).range(0, 0);
                if (isMounted && typeof count === "number") setTotalCount(count);
            } catch (err) {
                console.error("Realtime count refresh failed:", err);
            }
        };

        const channel = supabase
            .channel(`vectra_team_live_${Math.random().toString(36).slice(2)}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
                if (!isMounted) return;

                if (payload.eventType === "INSERT") {
                    clearTimeout(insertTimeoutId);
                    insertTimeoutId = setTimeout(() => {
                        if (isMounted) fetchPage(true, true);
                    }, 500);
                    return;
                }

                const id = payload.eventType === "DELETE" ? (payload.old as any)?.id : (payload.new as any)?.id;
                if (!id) return;
                if (payload.eventType === "DELETE") {
                    pendingDeletedIds.add(id);
                } else {
                    pendingUpdatedIds.add(id);
                }
                clearTimeout(patchTimeoutId);
                patchTimeoutId = setTimeout(() => {
                    if (isMounted) flushPatches();
                }, 400);
            })
            .subscribe();

        return () => {
            isMounted = false;
            clearTimeout(insertTimeoutId);
            clearTimeout(patchTimeoutId);
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, debouncedSearch, selectedDepartment]);

    const hasMore = useMemo(() => members.length < totalCount, [members.length, totalCount]);

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Contact className="w-6 h-6 text-blue-600" />
                        Vectra Team
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">See who's working at Vectra and what they do</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
                    <div className="relative w-full md:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, ID, role..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="w-[160px] flex items-center text-left pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                        >
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <Filter className="w-4 h-4 text-slate-500" />
                            </div>
                            <span className="truncate">{selectedDepartment === "All" ? "Filter: All" : selectedDepartment}</span>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                <svg className={`w-4 h-4 text-slate-500 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </button>

                        {isFilterOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-20 py-2"
                                >
                                    <div className="px-3 pb-2 mb-2 border-b border-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Departments
                                    </div>
                                    {departments.map((dep) => (
                                        <button
                                            key={dep}
                                            onClick={() => {
                                                setSelectedDepartment(dep);
                                                setIsFilterOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                                                selectedDepartment === dep
                                                    ? "bg-blue-50/50 text-blue-700 font-medium"
                                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                            }`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${selectedDepartment === dep ? "bg-blue-600" : "bg-transparent"}`} />
                                            {dep === "All" ? "All Departments" : dep}
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Employee</th>
                                    <th className="px-6 py-4 font-medium">Email</th>
                                    <th className="px-6 py-4 font-medium">Employee ID</th>
                                    <th className="px-6 py-4 font-medium">Department</th>
                                    <th className="px-6 py-4 font-medium">Job Role</th>
                                    <th className="px-6 py-4 font-medium">Designation</th>
                                    <th className="px-6 py-4 font-medium text-center">LinkedIn</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span>Loading team...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-red-500">{error}</td>
                                    </tr>
                                ) : members.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No employees found.</td>
                                    </tr>
                                ) : (
                                    members.map((member, index) => (
                                        <motion.tr
                                            key={member.uid}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3, delay: Math.min(index, 20) * 0.02 }}
                                            className="bg-white hover:bg-slate-50/80 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => member.avatarUrl && setLightbox({ src: member.avatarUrl, name: member.name })}
                                                        disabled={!member.avatarUrl}
                                                        className={`rounded-full shrink-0 ${member.avatarUrl ? "cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 transition-all" : "cursor-default"}`}
                                                        title={member.avatarUrl ? "View photo" : undefined}
                                                    >
                                                        <Avatar
                                                            src={member.avatarThumbUrl || member.avatarUrl || undefined}
                                                            alt={member.name}
                                                            fallback={(member.name || "U").charAt(0).toUpperCase()}
                                                            size="sm"
                                                            fallbackClassName="bg-slate-100 text-slate-500 font-bold text-xs"
                                                        />
                                                    </button>
                                                    {member.name}
                                                    {member.uid === profile?.uid && (
                                                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">You</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {member.email ? (
                                                    <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                                                        <Mail className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate max-w-[200px]">{member.email}</span>
                                                    </a>
                                                ) : "-"}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">{member.employeeId}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={getDepartmentColor(member.department) as any} className="font-medium px-2.5 py-0.5">
                                                    {member.department}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{member.jobRole}</td>
                                            <td className="px-6 py-4 text-slate-600">{member.designation}</td>
                                            <td className="px-6 py-4 text-center">
                                                {member.linkedinUrl ? (
                                                    <a
                                                        href={member.linkedinUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#0A66C2] bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 transition-colors"
                                                        title="View LinkedIn profile"
                                                    >
                                                        <LinkedInIcon className="w-4 h-4" />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
                        <div>
                            Showing <span className="font-medium text-slate-900">{members.length}</span> of{" "}
                            <span className="font-medium text-slate-900">{totalCount}</span> employees
                        </div>
                        {hasMore && (
                            <button
                                onClick={() => fetchPage(false)}
                                disabled={loadingMore}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loadingMore ? "Loading..." : "Load More"}
                            </button>
                        )}
                    </div>
                </Card>
            </motion.div>

            <AnimatePresence>
                {lightbox && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setLightbox(null)}
                            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative z-10 flex flex-col items-center gap-3 max-w-[90vw] max-h-[90vh]"
                        >
                            <button
                                onClick={() => setLightbox(null)}
                                className="absolute -top-3 -right-3 text-slate-700 hover:text-slate-900 bg-white rounded-full p-2 shadow-lg transition-colors"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            {/* Same URL as the row thumbnail — already in the browser
                                cache, so this renders instantly with no new fetch. */}
                            <img
                                src={lightbox.src}
                                alt={lightbox.name}
                                className="max-w-[90vw] max-h-[80vh] rounded-2xl shadow-2xl object-contain bg-white"
                            />
                            <p className="text-white font-semibold text-sm drop-shadow">{lightbox.name}</p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
