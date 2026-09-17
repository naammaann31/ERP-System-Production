/**
 * A small number of employees are granted Marketing Team Lead-equivalent
 * access as an explicit, individually-approved exception — without changing
 * their actual role, department, or designation anywhere else in the app.
 *
 * Kept as an allowlist by user id, rather than widening any role/designation
 * check, so the exception stays scoped to exactly the people who were
 * actually granted it: easy to find, easy to audit, and it never silently
 * extends to someone else who happens to share a designation or job title
 * later. The same id also has to be granted at the database level (see the
 * matching Postgres function in the migrations) — RLS is what actually
 * protects the data, this file only controls what the UI offers.
 */
const EXTRA_MARKETING_TEAM_LEAD_UIDS = new Set<string>([
    "f84b92cc-7950-4304-b6e4-37b5056140aa", // Yudhisthir Soni — T&D Manager (Sales)
]);

export function hasMarketingTeamLeadOverride(uid: string | null | undefined): boolean {
    return !!uid && EXTRA_MARKETING_TEAM_LEAD_UIDS.has(uid);
}

/**
 * True for an actual Marketing-department Team-Lead, or for someone granted
 * the override above.
 */
export function isMarketingTeamLead(
    profile: { uid?: string | null; role?: string | null; designation?: string | null; jobRole?: string | null } | null | undefined
): boolean {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    if (role === "MARKETING" && (profile.designation === "Team-Lead" || profile.jobRole === "Team-Lead")) {
        return true;
    }
    return hasMarketingTeamLeadOverride(profile.uid);
}
