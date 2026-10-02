import * as xlsx from "xlsx";
import { toast } from "sonner";

export interface ParsedCandidateRow {
    full_name: string;
    phone: string | null;
    marketing_email: string | null;
    marketing_password: string | null;
    linkedin_email: string | null;
    linkedin_password: string | null;
    technology: string | null;
    visa_status: string | null;
    status: string;
    notes: string;
    created_by_name: string | null;
}

/**
 * Imports the marketing team's candidate sheet.
 *
 * Parsed positionally (`header: 1`) rather than as objects, because the
 * sheet has TWO columns both headed "Password" — one for the marketing
 * email, one for LinkedIn. Object parsing would silently collapse or
 * rename the second, so instead each "Password" column is attached to
 * whichever email column preceded it. Header names are matched loosely,
 * and the header row is located by finding "NAME" rather than assuming
 * row 1, since the sheet starts with a blank row.
 */
export function parseCandidatesWorkbook(
    workbook: xlsx.WorkBook,
    createdByName: string | null
): { pending: ParsedCandidateRow[]; skipped: number } | null {
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const grid = xlsx.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        defval: "",
        blankrows: false,
    });

    const norm = (v: any) => String(v ?? "").trim().toLowerCase();
    let headerIdx = grid.findIndex((r) =>
        (r || []).some((c) => norm(c) === "name" || norm(c) === "candidate name")
    );

    // Some real exports of this sheet (confirmed on the actual "Candidates
    // Details" tab) leave the Name column's own header blank while still
    // labelling every other column. Rather than fail outright, fall back to
    // locating the header row by its OTHER recognisable fields, the same way
    // the Marketing Leads importer scores a header row — and if Name still
    // isn't found but column 0 is free, assume it holds the name, which is
    // how every sheet of this shape seen so far is laid out.
    let nameColOverride: number | null = null;
    if (headerIdx === -1) {
        const HEADER_SCAN_ROWS = 25;
        for (let r = 0; r < Math.min(HEADER_SCAN_ROWS, grid.length); r++) {
            const row = grid[r] || [];
            let score = 0;
            let col0Labelled = false;
            row.forEach((h: any, i: number) => {
                const k = norm(h);
                if (!k) return;
                if (i === 0) col0Labelled = true;
                if (k.includes("contact") || k.includes("phone") || k.includes("mobile")) score++;
                else if (k.includes("marketing") && k.includes("email")) score++;
                else if ((k.includes("linkedin") || k.includes("linked in")) && k.includes("email")) score++;
                else if (k.includes("technology") || k.includes("tech")) score++;
                else if (k.includes("visa")) score++;
            });
            if (score >= 2 && !col0Labelled) {
                headerIdx = r;
                nameColOverride = 0;
                break;
            }
        }
    }

    if (headerIdx === -1) {
        toast.error('Could not find a "NAME" column header in the sheet.');
        return null;
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

    if (cols.full_name === undefined && nameColOverride !== null) {
        cols.full_name = nameColOverride;
    }

    const cell = (row: any[], key: string) => {
        const i = cols[key];
        if (i === undefined) return null;
        const v = String(row?.[i] ?? "").trim();
        return v === "" ? null : v;
    };

    const pending: ParsedCandidateRow[] = [];
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
            created_by_name: createdByName,
        });
    }

    if (pending.length === 0) {
        toast.error("No valid rows found. Each row needs at least a name.");
        return null;
    }

    return { pending, skipped };
}
