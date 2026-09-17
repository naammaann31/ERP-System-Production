import * as xlsx from "xlsx";
import { toast } from "sonner";

export type Section = "interview" | "screening";

export interface StagedSectionChoice {
    rows: any[];
    guess: Section;
    fileName: string;
}

/**
 * Imports Interview / Screening rows from Excel into Supabase.
 *
 * Accepts three shapes:
 *  1. A workbook with sheets named "Interview" and/or "Screening" —
 *     i.e. exactly what this page's Export XL produces, so an
 *     export → edit → import round trip works.
 *  2. A single sheet laid out like the source Google Sheet, with the
 *     two tables side by side under an "Interview"/"Screening" group
 *     header row. Each block is located by its own Date+Candidate header
 *     pair rather than assumed to start at a fixed column.
 *  3. One bare 6-column table (Date, Candidate, Client, Stage/Method,
 *     Recruiter, Remarks) with no headers at all — what you get when a
 *     single table is copied out of the sheet on its own. Nothing in the
 *     file says which of the two tables it is, so the user is asked.
 *
 * `onNeedsSectionChoice` is called (in place of the original inline
 * `setSectionPrompt(...)`) when shape 3 is detected and the caller must ask
 * the user which section the rows belong to.
 */
export function parseInterviewScreeningWorkbook(
    workbook: xlsx.WorkBook,
    fileName: string,
    createdByName: string | null,
    onNeedsSectionChoice: (staged: StagedSectionChoice) => void
): { pending: any[]; invalid: number } | null {
    const pick = (row: any, keys: string[]) => {
        for (const k of keys) {
            const hit = Object.keys(row).find((c) => c.trim().toLowerCase() === k.toLowerCase());
            if (hit && String(row[hit] ?? "").trim() !== "") return row[hit];
        }
        return "";
    };

    /**
     * Dates are taken as the cell's DISPLAYED text, never its
     * underlying value.
     *
     * In the real exports the two disagree: a cell showing
     * "May-01" stores 2001-04-30, because whatever produced the
     * file read the sheet's "May 1" as May *2001*. The displayed
     * text is the only surviving record of the intended date, and
     * it also matches how rows pulled from the Google Sheet are
     * already stored (entry_date is free text). So no year is
     * invented and no serial-number conversion is needed —
     * `raw: false` below hands us the formatted string directly.
     */
    const text = (v: any) => String(v ?? "").trim();

    const pending: any[] = [];
    let invalid = 0;

    const pushRow = (section: Section, r: any) => {
        const candidate = text(pick(r, ["Candidate", "Candidate Name", "Name"]));
        if (!candidate) { invalid++; return; }
        pending.push({
            section,
            entry_date: text(pick(r, ["Date"])),
            candidate,
            client: text(pick(r, ["Client", "Company", "Company Name"])),
            stage:
                section === "interview"
                    ? text(pick(r, ["Stage (No of Round)", "Stage(No of Round)", "Stage", "Round"]))
                    : text(pick(r, ["Screening/AI", "Screening / AI", "Screening", "Method"])),
            recruiter: text(pick(r, ["Recruiter"])),
            remarks: text(pick(r, ["Remarks", "Remark"])),
            created_by_name: createdByName,
        });
    };

    const named = workbook.SheetNames.filter((n) =>
        ["interview", "screening"].includes(n.trim().toLowerCase())
    );

    if (named.length > 0) {
        // Shape 1: separate named sheets
        for (const name of named) {
            const section: Section =
                name.trim().toLowerCase() === "interview" ? "interview" : "screening";
            const rows = xlsx.utils.sheet_to_json(workbook.Sheets[name], {
                defval: "", raw: false,
            });
            (rows as any[]).forEach((r) => pushRow(section, r));
        }
    } else {
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        // raw: false yields each cell's displayed text — see the
        // note on `text` above for why that matters for dates.
        const grid = xlsx.utils.sheet_to_json<any[]>(ws, {
            header: 1, defval: "", blankrows: true, raw: false,
        });
        const cell = (row: any[], i: number) => row?.[i] ?? "";
        const norm = (v: any) => String(v ?? "").trim().toLowerCase();

        const headerRow = grid.findIndex((r) =>
            (r || []).some((c) => norm(c) === "candidate")
        );

        // Each block starts at its own Date+Candidate header pair.
        // Locating them beats assuming fixed columns 0 and 6: a
        // spacer or extra leading column would otherwise shift every
        // field silently (client into stage, stage into recruiter).
        const blocks: { section: Section; base: number }[] = [];

        if (headerRow !== -1) {
            const header = grid[headerRow] || [];
            // The group header row above carries "Interview" /
            // "Screening"; merged cells put the label on the
            // block's first column, so scan leftwards for it.
            const groupRow = headerRow > 0 ? grid[headerRow - 1] || [] : [];

            header.forEach((h: any, i: number) => {
                if (norm(h) !== "date") return;
                if (norm(header[i + 1]) !== "candidate") return;
                let section: Section | null = null;
                for (let c = i; c >= 0 && section === null; c--) {
                    const g = norm(groupRow[c]);
                    if (g.includes("interview")) section = "interview";
                    else if (g.includes("screening")) section = "screening";
                }
                // Fall back on the block's own 4th column, which is
                // "Stage (No of Round)" vs "Screening/AI".
                if (section === null) {
                    section = norm(header[i + 3]).includes("screening") ? "screening" : "interview";
                }
                blocks.push({ section, base: i });
            });
        }

        const readBlocks = (from: number, into: { section: Section; base: number }[]) => {
            for (let i = from; i < grid.length; i++) {
                const row = grid[i] || [];
                for (const { section, base } of into) {
                    const span = [0, 1, 2, 3, 4, 5].map((o) => base + o);
                    // Blocks pad each other with blanks when one
                    // table is longer, so skip a block that is
                    // empty on this row.
                    if (!span.some((c) => String(cell(row, c)).trim() !== "")) continue;
                    pushRow(section, {
                        Date: cell(row, base),
                        Candidate: cell(row, base + 1),
                        Client: cell(row, base + 2),
                        [section === "interview" ? "Stage" : "Screening"]: cell(row, base + 3),
                        Recruiter: cell(row, base + 4),
                        Remarks: cell(row, base + 5),
                    });
                }
            }
        };

        if (blocks.length > 0) {
            // Shape 2: labelled, one or both tables present.
            readBlocks(headerRow + 1, blocks);
        } else {
            // Shape 3: a bare table with no headers whatsoever, so
            // the file cannot say which section it is. Parse it
            // into staged rows and let the user pick.
            const staged: any[] = [];
            const sink = pending.length;
            readBlocks(0, [{ section: "screening", base: 0 }]);
            staged.push(...pending.splice(sink));

            if (staged.length === 0) {
                toast.error("No valid rows found. Each row needs at least a Candidate name.");
                return null;
            }

            // The filename is the only hint available, so it seeds
            // the default choice rather than deciding silently.
            const guess: Section = /interview/i.test(fileName) ? "interview" : "screening";
            onNeedsSectionChoice({ rows: staged, guess, fileName });
            return null;
        }
    }

    if (pending.length === 0) {
        toast.error("No valid rows found. Each row needs at least a Candidate name.");
        return null;
    }

    return { pending, invalid };
}
