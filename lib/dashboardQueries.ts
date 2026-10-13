import { createClient } from "@/lib/supabase/client";

export interface DashboardProfileRow {
    id: string;
    full_name: string | null;
    role: string | null;
    job_role: string | null;
    status: string | null;
    avatar_url: string | null;
    avatar_thumb_url: string | null;
}

/**
 * Every profile, unfiltered — the columns TopStats and TeamStatusWidget
 * between them actually use.
 *
 * Only safe to share between the two for an Admin viewer: TopStats' own
 * counts query was already unfiltered by role (just `.neq("role","Admin")`,
 * applied client-side here instead), so widening it to literally everyone
 * is a small, acceptable increase. TeamStatusWidget's query for HR/regular
 * employees is NOT this — it's deliberately scoped to `role = viewer's own
 * role` (their department only), and must keep using its own narrower
 * query; sharing this broader one with them would mean downloading the
 * whole company's profiles just to display a same-department list.
 */
export async function fetchAllProfilesForDashboard(): Promise<DashboardProfileRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, job_role, status, avatar_url, avatar_thumb_url");
    if (error) throw error;
    return data || [];
}

/**
 * Same columns as fetchAllProfilesForDashboard, scoped to one role — used
 * by TeamStatusWidget for an HR/regular-employee viewer, who should only
 * ever see their own department's team, same as before this migration.
 * Deliberately a separate query key from the "all profiles" one above —
 * never meant to share a cache entry with it.
 */
export async function fetchProfilesByRoleForDashboard(role: string): Promise<DashboardProfileRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, job_role, status, avatar_url, avatar_thumb_url")
        .eq("role", role);
    if (error) throw error;
    return data || [];
}

export interface DashboardAttendanceRow {
    user_id: string;
    status: string;
    is_late: boolean;
}

/**
 * Today's attendance, every user — safe to share across every viewer role,
 * since TeamStatusWidget's own version of this query was never filtered by
 * role to begin with (unlike its profiles query).
 */
export async function fetchTodayAttendanceForDashboard(dateStr: string): Promise<DashboardAttendanceRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("attendance")
        .select("user_id, status, is_late")
        .eq("date", dateStr);
    if (error) throw error;
    return data || [];
}
