// Header-driven Excel parser for the Marketing "Data Leads" sheet.
//
// Marketing employees hand in workbooks that are not standardised: columns come
// in any order, headers carry stray spaces/casing, and the Date column may hold
// Excel serials, real Date objects, "14/09/2026," strings, "4/23/2026" strings,
// ISO strings or nothing at all. Everything here is therefore driven by the
// *detected* header text and by the *original* cell value type — never by column
// position and never by `new Date(someString)`.
//
// Calendar safety rule for this file: a date is only ever produced by building
// the Y/M/D triple explicitly. No value is round-tripped through a locale string
// and re-parsed, which is what used to shift dates backwards by a day in IST.

import * as xlsx from "xlsx";

/** Canonical internal/database format: "YYYY-MM-DD". */
export type CanonicalDate = string;

export interface MarketingImportRow {
    name: string;
    /** Canonical YYYY-MM-DD, or null when the sheet genuinely has no date. */
    date: CanonicalDate | null;
    companyName: string;
    link: string;
    /** 1-based row number as shown in Excel, for diagnostics. */
    excelRow: number;
    /** True when the date came from the row's merged/grouped block, not its own cell. */
    dateInherited: boolean;
}

export interface RejectedRow {
    excelRow: number;
    reason: "ambiguous-date" | "unreadable-date" | "no-lead-info";
    rawDate?: string;
}

export type DateOrientation = "day-first" | "month-first" | "unresolved";

export interface MarketingImportDiagnostics {
    sheetName: string;
    /** 0-based index of the detected header row within the sheet. */
    headerRowIndex: number;
    headers: string[];
    columns: { name: number; date: number; companyName: number; link: number };
    /** Headers present in the sheet that the Marketing schema does not use. */
    extraColumns: string[];
    rowsScanned: number;
    blankRowsSkipped: number;
    validRows: number;
    rejectedRows: number;
    /** Rows imported with a null date because the sheet has no date for them. */
    missingDateRows: number;
    /** Rows whose date was inherited from their merged/grouped block. */
    inheritedDateRows: number;
    /** Rows whose stored serial was read back the way the sheet is written. */
    repairedDateRows: number;
    repairNote: string | null;
    /** Counts of the raw value kinds seen in the Date column. */
    dateValueKinds: Record<string, number>;
    /** How each "a/b/yyyy" style group in this workbook was disambiguated. */
    dateOrientation: Record<string, { orientation: DateOrientation; evidence: string }>;
    usesDate1904: boolean;
    mergedDateCells: number;
    samples: Array<{ excelRow: number; raw: unknown; rawType: string; canonical: CanonicalDate | null }>;
    rejects: RejectedRow[];
}

export interface MarketingImportSuccess {
    ok: true;
    rows: MarketingImportRow[];
    diagnostics: MarketingImportDiagnostics;
}

export interface MarketingImportFailure {
    ok: false;
    /** An empty workbook is a normal outcome, not an error the user must fix. */
    kind: "empty-workbook" | "no-header" | "missing-columns";
    /** Ready-to-show, human readable explanation of what could not be identified. */
    error: string;
}

export type MarketingImportResult = MarketingImportSuccess | MarketingImportFailure;

// ── Header matching ───────────────────────────────────────────────────────────

/**
 * Normalise a header for matching: trim, lowercase, collapse runs of whitespace
 * (including non-breaking spaces and newlines) and drop decorative punctuation
 * from both ends. "Date:", " DATE ", "date  :" and "Date" all become "date".
 */
export function normalizeHeader(value: unknown): string {
    return String(value ?? "")
        .replace(/[  -​]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
        .replace(/^[^a-z0-9]+/, "")
        .replace(/[^a-z0-9)]+$/, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Aliases are matched exactly (after normalisation) so that a column called
// "Company Name" can never be mistaken for the candidate "Name" column.
const FIELD_ALIASES = {
    name: [
        "name", "names", "candidate", "candidate name", "candidate names",
        "candidates name", "candidate s name", "full name", "consultant",
        "consultant name", "resource", "resource name", "applicant",
        "applicant name", "employee name", "bench candidate",
    ],
    date: [
        "date", "dates", "date applied", "applied date", "application date",
        "apply date", "date of application", "submission date", "submitted on",
        "applied on",
    ],
    companyName: [
        "company name", "companyname", "company names", "company", "companies",
        "employer", "employer name", "organization", "organisation",
        "organization name", "client", "client name", "firm", "company client",
    ],
    link: [
        "link", "links", "url", "urls", "job link", "joblink", "apply link",
        "application link", "job url", "profile link", "posting link",
        "job posting link", "portal link", "link url", "url link", "job posting",
    ],
} as const;

type FieldKey = keyof typeof FIELD_ALIASES;
const FIELD_KEYS: FieldKey[] = ["name", "date", "companyName", "link"];

const FIELD_LABELS: Record<FieldKey, string> = {
    name: "Name",
    date: "Date",
    companyName: "Company Name",
    link: "Link",
};

/** Number of leading rows searched for the header (titles/notes/blank rows). */
const HEADER_SCAN_ROWS = 25;

function matchColumns(row: unknown[]): Record<FieldKey, number> {
    const found: Record<FieldKey, number> = { name: -1, date: -1, companyName: -1, link: -1 };
    if (!Array.isArray(row)) return found;

    for (let c = 0; c < row.length; c++) {
        const header = normalizeHeader(row[c]);
        if (!header) continue;
        for (const key of FIELD_KEYS) {
            if (found[key] < 0 && (FIELD_ALIASES[key] as readonly string[]).includes(header)) {
                found[key] = c;
                break;
            }
        }
    }
    return found;
}

// ── Calendar-safe date helpers ────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function isRealCalendarDate(y: number, m: number, d: number): boolean {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
    const daysInMonth = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= daysInMonth[m - 1];
}

function toCanonical(y: number, m: number, d: number): CanonicalDate | null {
    return isRealCalendarDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : null;
}

/**
 * Excel serial number → canonical date.
 *
 * This is the conversion that made the existing import correct and it is kept
 * verbatim: the serial is turned into a UTC instant and read back with the UTC
 * getters, so the calendar day can never be dragged across a timezone boundary.
 * `date1904` shifts the epoch for workbooks saved with the 1904 date system.
 */
export function excelSerialToCanonical(serial: number, date1904 = false): CanonicalDate | null {
    if (!Number.isFinite(serial)) return null;
    const days = Math.floor(serial) + (date1904 ? 1462 : 0);
    // Serials ≤ 60 land on Excel's phantom 29-Feb-1900; 2958465 is 31-Dec-9999.
    if (days < 61 || days > 2958465) return null;

    const utcMs = (days - 25569) * 86400 * 1000;
    const d = new Date(utcMs);
    if (isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Date object → canonical date.
 *
 * SheetJS builds these from the serial through a local-timezone epoch, and that
 * conversion drifts by a few seconds (it lands on 13-Sep 23:59:59.999 for a cell
 * Excel shows as 14-Sep). Reading the local getters straight off such a value
 * therefore loses a day, so anything sitting within a few minutes of midnight is
 * snapped to the midnight it is obviously meant to be. A genuine time-of-day
 * (09:30, 18:00 …) is far from that window and keeps its own day.
 */
const MIDNIGHT_SNAP_MS = 15 * 60 * 1000;

export function jsDateToCanonical(value: Date): CanonicalDate | null {
    if (isNaN(value.getTime())) return null;

    let d = value;
    const msIntoDay =
        value.getHours() * 3600000 + value.getMinutes() * 60000 +
        value.getSeconds() * 1000 + value.getMilliseconds();
    const msToMidnight = 86400000 - msIntoDay;
    if (msToMidnight <= MIDNIGHT_SNAP_MS) d = new Date(value.getTime() + msToMidnight);
    else if (msIntoDay <= MIDNIGHT_SNAP_MS) d = new Date(value.getTime() - msIntoDay);

    return toCanonical(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

const MONTH_NAMES: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
    september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function expandYear(raw: string): number {
    const n = parseInt(raw, 10);
    if (raw.length === 4) return n;
    return n < 70 ? 2000 + n : 1900 + n;
}

/**
 * A Date-column cell, classified without committing to a calendar day for the
 * numeric "a/b/yyyy" shapes — those are resolved later using workbook evidence.
 */
type DateToken =
    | { kind: "empty" }
    | { kind: "resolved"; canonical: CanonicalDate; proof?: { sep: string; orientation: "day-first" | "month-first" } }
    | { kind: "ambiguous"; sep: string; a: number; b: number; year: number }
    | { kind: "unreadable" };

function classifyDateValue(raw: unknown, date1904: boolean): DateToken {
    if (raw === null || raw === undefined) return { kind: "empty" };

    if (raw instanceof Date) {
        const canonical = jsDateToCanonical(raw);
        return canonical ? { kind: "resolved", canonical } : { kind: "unreadable" };
    }

    if (typeof raw === "number") return classifyNumericDate(raw, date1904);

    if (typeof raw !== "string") return { kind: "unreadable" };

    // Strip the stray trailing "," / ";" / "." some sheets carry ("14/09/2026,").
    const str = raw.replace(/\s+/g, " ").trim().replace(/[,;.]+$/, "").trim();
    if (str === "") return { kind: "empty" };

    // ISO (optionally with a time part) — already canonical.
    const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
    if (iso) {
        const canonical = toCanonical(+iso[1], +iso[2], +iso[3]);
        return canonical ? { kind: "resolved", canonical } : { kind: "unreadable" };
    }

    // YYYY/MM/DD — unambiguous because the 4-digit year comes first.
    const isoSlash = str.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
    if (isoSlash) {
        const canonical = toCanonical(+isoSlash[1], +isoSlash[2], +isoSlash[3]);
        return canonical ? { kind: "resolved", canonical } : { kind: "unreadable" };
    }

    // A serial that was stored as text.
    if (/^\d+(\.\d+)?$/.test(str)) return classifyNumericDate(parseFloat(str), date1904);

    // "14 Sep 2026" / "14-Sep-2026" / "Sep 14 2026" / "September 4, 2026".
    const dayMonthName = str.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,9})[\s\-/]+(\d{2,4})$/);
    if (dayMonthName) {
        const month = MONTH_NAMES[dayMonthName[2].toLowerCase()];
        const canonical = month ? toCanonical(expandYear(dayMonthName[3]), month, +dayMonthName[1]) : null;
        return canonical ? { kind: "resolved", canonical } : { kind: "unreadable" };
    }
    const monthNameDay = str.match(/^([A-Za-z]{3,9})[\s\-/]+(\d{1,2})(?:\s*,)?[\s\-/]+(\d{2,4})$/);
    if (monthNameDay) {
        const month = MONTH_NAMES[monthNameDay[1].toLowerCase()];
        const canonical = month ? toCanonical(expandYear(monthNameDay[3]), month, +monthNameDay[2]) : null;
        return canonical ? { kind: "resolved", canonical } : { kind: "unreadable" };
    }

    // The ambiguous family: 4/23/2026, 23/04/2026, 06-07-2026, 4.5.26 …
    const numeric = str.match(/^(\d{1,2})([/\-.])(\d{1,2})\2(\d{2}|\d{4})$/);
    if (numeric) {
        const sep = numeric[2];
        const a = +numeric[1];
        const b = +numeric[3];
        const year = expandYear(numeric[4]);
        const dayFirst = toCanonical(year, b, a);
        const monthFirst = toCanonical(year, a, b);

        // "4/23/2026" can only be month-first and "23/04/2026" can only be
        // day-first: those read themselves, and they also stand as evidence for
        // how the rest of this workbook is written.
        if (dayFirst && !monthFirst) return { kind: "resolved", canonical: dayFirst, proof: { sep, orientation: "day-first" } };
        if (monthFirst && !dayFirst) return { kind: "resolved", canonical: monthFirst, proof: { sep, orientation: "month-first" } };
        if (!dayFirst && !monthFirst) return { kind: "unreadable" };
        return { kind: "ambiguous", sep, a, b, year };
    }

    return { kind: "unreadable" };
}

function classifyNumericDate(value: number, date1904: boolean): DateToken {
    // A plain YYYYMMDD number cannot be a serial (max serial is 2958465).
    if (Number.isInteger(value) && value >= 19000101 && value <= 99991231) {
        const canonical = toCanonical(Math.floor(value / 10000), Math.floor(value / 100) % 100, value % 100);
        if (canonical) return { kind: "resolved", canonical };
    }
    const canonical = excelSerialToCanonical(value, date1904);
    return canonical ? { kind: "resolved", canonical } : { kind: "unreadable" };
}

/** Both readings of an ambiguous token; either may be an impossible calendar day. */
function readAmbiguous(token: { a: number; b: number; year: number }) {
    return {
        dayFirst: toCanonical(token.year, token.b, token.a),
        monthFirst: toCanonical(token.year, token.a, token.b),
    };
}

// ── Workbook-level disambiguation of d/m vs m/d ───────────────────────────────

interface AmbiguityDecision {
    orientation: DateOrientation;
    evidence: string;
}

/**
 * Decide, per separator style, whether this workbook writes day-first or
 * month-first. Only real evidence is used, and when there is none the group stays
 * "unresolved" so the affected rows are reported instead of silently corrupted.
 *
 *  1. Self-evident values in the same group ("4/23/2026" can only be month-first).
 *  2. Chronological fit against the column's unambiguous dates (serials, ISO …):
 *     the reading that never contradicts the sheet's own date order wins.
 *  3. With no anchors at all: the reading that keeps the group monotonic, but
 *     only when exactly one reading does.
 */
function decideOrientation(
    sep: string,
    group: Array<{ rowIndex: number; a: number; b: number; year: number }>,
    anchors: Array<{ rowIndex: number; canonical: CanonicalDate }>,
    proofs: { dayFirst: number; monthFirst: number },
): AmbiguityDecision {
    const dayFirstProof = proofs.dayFirst;
    const monthFirstProof = proofs.monthFirst;
    if (dayFirstProof > 0 && monthFirstProof === 0) {
        return { orientation: "day-first", evidence: `${dayFirstProof} value(s) with a day > 12 (e.g. 14${sep}09${sep}2026)` };
    }
    if (monthFirstProof > 0 && dayFirstProof === 0) {
        return { orientation: "month-first", evidence: `${monthFirstProof} value(s) with a second part > 12 (e.g. 4${sep}23${sep}2026)` };
    }
    if (dayFirstProof > 0 && monthFirstProof > 0) {
        return {
            orientation: "unresolved",
            evidence: `conflicting evidence (${dayFirstProof} day-first vs ${monthFirstProof} month-first)`,
        };
    }

    // ── 2. Chronological fit ──
    const sorted = [...anchors].sort((x, y) => x.rowIndex - y.rowIndex);
    if (sorted.length >= 3) {
        let asc = 0;
        let desc = 0;
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].canonical > sorted[i - 1].canonical) asc++;
            else if (sorted[i].canonical < sorted[i - 1].canonical) desc++;
        }
        const moves = asc + desc;
        const direction = moves >= 2 && asc / moves >= 0.9 ? "asc" : moves >= 2 && desc / moves >= 0.9 ? "desc" : null;

        if (direction) {
            const violations = (pick: "dayFirst" | "monthFirst") => {
                let count = 0;
                for (const t of group) {
                    const candidate = readAmbiguous(t)[pick];
                    if (!candidate) return Number.POSITIVE_INFINITY; // impossible calendar day
                    let prev: CanonicalDate | null = null;
                    let next: CanonicalDate | null = null;
                    for (const anchor of sorted) {
                        if (anchor.rowIndex < t.rowIndex) prev = anchor.canonical;
                        else if (anchor.rowIndex > t.rowIndex) { next = anchor.canonical; break; }
                    }
                    const tooEarly = direction === "asc" ? (prev !== null && candidate < prev) : (next !== null && candidate < next);
                    const tooLate = direction === "asc" ? (next !== null && candidate > next) : (prev !== null && candidate > prev);
                    if (tooEarly || tooLate) count++;
                }
                return count;
            };

            const dayViolations = violations("dayFirst");
            const monthViolations = violations("monthFirst");
            if (dayViolations === 0 && monthViolations > 0) {
                return {
                    orientation: "day-first",
                    evidence: `fits the sheet's ${direction === "asc" ? "ascending" : "descending"} date order (month-first would break it in ${monthViolations} row(s))`,
                };
            }
            if (monthViolations === 0 && dayViolations > 0) {
                return {
                    orientation: "month-first",
                    evidence: `fits the sheet's ${direction === "asc" ? "ascending" : "descending"} date order (day-first would break it in ${dayViolations} row(s))`,
                };
            }
        }
    }

    // ── 3. Self-consistency, only when nothing else is available ──
    if (anchors.length === 0 && group.length >= 3) {
        const monotonic = (pick: "dayFirst" | "monthFirst") => {
            const seq: CanonicalDate[] = [];
            for (const t of [...group].sort((x, y) => x.rowIndex - y.rowIndex)) {
                const candidate = readAmbiguous(t)[pick];
                if (!candidate) return false;
                seq.push(candidate);
            }
            const nonDecreasing = seq.every((v, i) => i === 0 || v >= seq[i - 1]);
            const nonIncreasing = seq.every((v, i) => i === 0 || v <= seq[i - 1]);
            return nonDecreasing || nonIncreasing;
        };
        const dayOk = monotonic("dayFirst");
        const monthOk = monotonic("monthFirst");
        if (dayOk && !monthOk) return { orientation: "day-first", evidence: "only day-first keeps the column in date order" };
        if (monthOk && !dayOk) return { orientation: "month-first", evidence: "only month-first keeps the column in date order" };
    }

    return { orientation: "unresolved", evidence: "no reliable evidence in this workbook" };
}

// ── Repair of dates Excel itself mis-parsed ──────────────────────────────────
//
// When an employee types "09/11/2026" meaning 11 September into a workbook whose
// locale reads d/m/y, Excel stores the serial for 9 November and then *displays*
// it back as "09/11/2026" — so the sheet looks right to its author while the
// stored day is wrong. The giveaway is chronology: these sheets are day-by-day
// logs, and the mis-read values are exactly the ones that break the order.
//
// Only values Excel interpreted (serials, Date cells) are candidates; text the
// employee typed is left alone. A swap is applied only if reading the affected
// cells the other way round makes the *entire* column consistent again, so a
// workbook that is already in order is never touched.

interface RepairRun {
    rowIndexes: number[];
    base: CanonicalDate;
    interpreted: boolean;
    alternative: CanonicalDate | null;
}

/** Month/day transposition, when the result is still a real calendar day. */
function transposeMonthDay(canonical: CanonicalDate): CanonicalDate | null {
    const [y, m, d] = canonical.split("-").map(Number);
    if (m === d) return null;
    return toCanonical(y, d, m);
}

function planDateRepair(runs: RepairRun[]): { picks: number[]; violations: number } | null {
    if (runs.length < 2) return null;

    const baseline = (direction: 1 | -1) => {
        let bad = 0;
        for (let i = 1; i < runs.length; i++) {
            if (direction === 1 ? runs[i].base < runs[i - 1].base : runs[i].base > runs[i - 1].base) bad++;
        }
        return bad;
    };
    const ascBad = baseline(1);
    const descBad = baseline(-1);
    const direction: 1 | -1 = ascBad <= descBad ? 1 : -1;
    const baselineViolations = Math.min(ascBad, descBad);
    if (baselineViolations === 0) return null;                       // already consistent
    if (baselineViolations > runs.length / 2) return null;           // no usable order at all

    const options = runs.map(r => (r.alternative ? [r.base, r.alternative] : [r.base]));
    if (!options.some(o => o.length > 1)) return null;

    // Preference order, strongest first: put the column back in date order, then
    // change as few rows as possible, then keep consecutive days close together —
    // that last one is what tells "4 Sep, 8 Sep" apart from "9 Apr, 9 Aug" when
    // both readings happen to be in order.
    interface Cost { violations: number; changedRows: number; spread: number }
    const better = (a: Cost, b: Cost | null) =>
        !b || a.violations !== b.violations ? (!b || a.violations < b.violations)
            : a.changedRows !== b.changedRows ? a.changedRows < b.changedRows
                : a.spread < b.spread;

    const dayGap = (a: CanonicalDate, b: CanonicalDate) => {
        const [ay, am, ad] = a.split("-").map(Number);
        const [by, bm, bd] = b.split("-").map(Number);
        return Math.abs(Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000;
    };

    type Node = { cost: Cost; from: number } | null;
    let prev: Node[] = options[0].map((_, c) => ({
        cost: { violations: 0, changedRows: c > 0 ? runs[0].rowIndexes.length : 0, spread: 0 },
        from: -1,
    }));
    const back: Node[][] = [prev];

    for (let i = 1; i < options.length; i++) {
        const cur: Node[] = options[i].map((value, c) => {
            let best: Node = null;
            for (let p = 0; p < options[i - 1].length; p++) {
                const previous = prev[p];
                if (!previous) continue;
                const previousValue = options[i - 1][p];
                const breaks = direction === 1 ? value < previousValue : value > previousValue;
                const cost: Cost = {
                    violations: previous.cost.violations + (breaks ? 1 : 0),
                    changedRows: previous.cost.changedRows + (c > 0 ? runs[i].rowIndexes.length : 0),
                    spread: previous.cost.spread + dayGap(value, previousValue),
                };
                if (better(cost, best ? best.cost : null)) best = { cost, from: p };
            }
            return best;
        });
        back.push(cur);
        prev = cur;
    }

    let bestEnd = -1;
    for (let c = 0; c < prev.length; c++) {
        const node = prev[c];
        if (node && (bestEnd < 0 || better(node.cost, prev[bestEnd]!.cost))) bestEnd = c;
    }
    if (bestEnd < 0 || prev[bestEnd]!.cost.violations > 0) return null;   // cannot make it consistent — leave the data alone

    const picks: number[] = new Array(options.length);
    let c = bestEnd;
    for (let i = options.length - 1; i >= 0; i--) { picks[i] = c; c = back[i][c]!.from; }
    return { picks, violations: baselineViolations };
}

// ── Sheet plumbing ────────────────────────────────────────────────────────────

const cellIsEmpty = (value: unknown) =>
    value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const rowIsBlank = (row: unknown[] | undefined) =>
    !row || !Array.isArray(row) || row.every(cellIsEmpty);

// Text columns treat a falsy cell (blank, 0, false) as empty, which is how the
// sheet's stray numeric placeholders have always been read.
const text = (value: unknown) => (!value ? "" : String(value).trim());

/**
 * Merged cells only carry a value in their top-left cell, so a date merged down
 * a group of rows reads as blank on every row but the first. This resolves a
 * cell to its merge anchor — strictly inside the merge's own bounds, so values
 * never leak into rows the workbook did not group together.
 */
function buildMergeLookup(sheet: xlsx.WorkSheet) {
    const merges = (sheet["!merges"] as xlsx.Range[] | undefined) || [];
    const anchorOf = new Map<string, { r: number; c: number }>();
    let mergedCells = 0;
    for (const range of merges) {
        for (let r = range.s.r; r <= range.e.r; r++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
                if (r === range.s.r && c === range.s.c) continue;
                anchorOf.set(`${r}:${c}`, { r: range.s.r, c: range.s.c });
                mergedCells++;
            }
        }
    }
    return {
        mergedCells,
        valueAt(rows: unknown[][], r: number, c: number): unknown {
            if (c < 0) return "";
            const own = rows[r]?.[c];
            if (!cellIsEmpty(own)) return own;
            const anchor = anchorOf.get(`${r}:${c}`);
            if (!anchor) return own;
            return rows[anchor.r]?.[anchor.c];
        },
    };
}

interface SheetCandidate {
    sheetName: string;
    rows: unknown[][];
    sheet: xlsx.WorkSheet;
    headerRowIndex: number;
    columns: Record<FieldKey, number>;
    score: number;
}

function inspectSheet(sheet: xlsx.WorkSheet, sheetName: string): SheetCandidate | null {
    if (!sheet || !sheet["!ref"]) return null;

    const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1, raw: true, defval: "", blankrows: true,
    });
    if (rows.length === 0) return null;

    let best: { index: number; columns: Record<FieldKey, number>; score: number } | null = null;
    for (let r = 0; r < Math.min(HEADER_SCAN_ROWS, rows.length); r++) {
        const columns = matchColumns(rows[r]);
        const score = FIELD_KEYS.filter(k => columns[k] >= 0).length;
        // Two recognisable field names is enough to call it a header row, and
        // far more than a normal data row will ever produce.
        if (score >= 2 && (!best || score > best.score)) best = { index: r, columns, score };
    }
    if (!best) return null;

    return {
        sheetName, rows, sheet,
        headerRowIndex: best.index,
        columns: best.columns,
        score: best.score,
    };
}

// ── Public entry point ────────────────────────────────────────────────────────

export function parseMarketingWorkbook(workbook: xlsx.WorkBook): MarketingImportResult {
    const sheetNames = workbook.SheetNames || [];
    if (sheetNames.length === 0) {
        return { ok: false, kind: "empty-workbook", error: "No valid data rows found in this file.\n\nThe workbook contains no worksheets." };
    }

    // Take the first sheet that actually looks like a lead table, so a title
    // sheet or an empty first tab does not block the import.
    let candidate: SheetCandidate | null = null;
    let anySheetHadRows = false;
    for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet && sheet["!ref"]) anySheetHadRows = true;
        const inspected = inspectSheet(sheet, sheetName);
        if (inspected) { candidate = inspected; break; }
    }

    if (!candidate) {
        if (!anySheetHadRows) {
            return { ok: false, kind: "empty-workbook", error: "No valid data rows found in this file.\n\nThe workbook is empty." };
        }
        return {
            ok: false,
            kind: "no-header",
            error:
                "Could not identify the header row.\n\n" +
                "Please ensure your Excel contains columns named like:\n" +
                "Name, Date, Company Name, Link",
        };
    }

    const { rows, sheet, sheetName, headerRowIndex, columns } = candidate;

    const missing = FIELD_KEYS.filter(k => k !== "link" && columns[k] < 0);
    if (missing.length > 0) {
        return {
            ok: false,
            kind: "missing-columns",
            error: missing
                .map(k => `Could not identify the ${FIELD_LABELS[k]} column.\nPlease ensure your Excel contains a ${FIELD_LABELS[k]} column.`)
                .join("\n\n"),
        };
    }

    const headerRow = (rows[headerRowIndex] || []) as unknown[];
    const mapped = new Set(FIELD_KEYS.map(k => columns[k]).filter(c => c >= 0));
    const extraColumns = headerRow
        .map((h, c) => ({ h: text(h), c }))
        .filter(x => x.h !== "" && !mapped.has(x.c))
        .map(x => x.h);

    const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
    const merge = buildMergeLookup(sheet);

    // ── Pass 1: classify every Date cell, keeping the original value type ──
    interface ScannedRow {
        rowIndex: number;
        name: string;
        companyName: string;
        link: string;
        rawDate: unknown;
        token: DateToken;
        canonical: CanonicalDate | null;
        /** True when Excel, not the employee, decided what this value means. */
        interpreted: boolean;
        blank: boolean;
    }

    const scanned: ScannedRow[] = [];
    const dateValueKinds: Record<string, number> = {};
    const ambiguousGroups = new Map<string, Array<{ rowIndex: number; a: number; b: number; year: number }>>();
    const orientationProofs = new Map<string, { dayFirst: number; monthFirst: number }>();
    const anchors: Array<{ rowIndex: number; canonical: CanonicalDate }> = [];
    let mergedDateCells = 0;

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        const rawDate = merge.valueAt(rows, r, columns.date);
        if (cellIsEmpty(row?.[columns.date]) && !cellIsEmpty(rawDate)) mergedDateCells++;

        const scannedRow: ScannedRow = {
            rowIndex: r,
            name: text(merge.valueAt(rows, r, columns.name)),
            companyName: text(merge.valueAt(rows, r, columns.companyName)),
            link: columns.link >= 0 ? text(merge.valueAt(rows, r, columns.link)) : "",
            rawDate,
            token: { kind: "empty" },
            canonical: null,
            interpreted: typeof rawDate === "number" || rawDate instanceof Date,
            blank: rowIsBlank(row),
        };

        if (!scannedRow.blank) {
            const token = classifyDateValue(rawDate, date1904);
            scannedRow.token = token;

            const slashShape = (sep: string) => `text d${sep}m or m${sep}d`;
            const kind =
                token.kind === "empty" ? "blank"
                    : rawDate instanceof Date ? "Date object"
                        : typeof rawDate === "number" ? "Excel serial"
                            : token.kind === "ambiguous" ? slashShape(token.sep)
                                : token.kind === "resolved" ? (token.proof ? slashShape(token.proof.sep) : "text date")
                                    : "unreadable";
            dateValueKinds[kind] = (dateValueKinds[kind] || 0) + 1;

            if (token.kind === "resolved") {
                scannedRow.canonical = token.canonical;
                anchors.push({ rowIndex: r, canonical: token.canonical });
                if (token.proof) {
                    const tally = orientationProofs.get(token.proof.sep) || { dayFirst: 0, monthFirst: 0 };
                    if (token.proof.orientation === "day-first") tally.dayFirst++;
                    else tally.monthFirst++;
                    orientationProofs.set(token.proof.sep, tally);
                }
            } else if (token.kind === "ambiguous") {
                const group = ambiguousGroups.get(token.sep) || [];
                group.push({ rowIndex: r, a: token.a, b: token.b, year: token.year });
                ambiguousGroups.set(token.sep, group);
            }
        }

        scanned.push(scannedRow);
    }

    // ── Pass 2: resolve the ambiguous groups with workbook evidence ──
    const dateOrientation: Record<string, { orientation: DateOrientation; evidence: string }> = {};
    for (const sep of new Set([...ambiguousGroups.keys(), ...orientationProofs.keys()])) {
        const group = ambiguousGroups.get(sep) || [];
        const proofs = orientationProofs.get(sep) || { dayFirst: 0, monthFirst: 0 };
        const decision = decideOrientation(sep, group, anchors, proofs);
        dateOrientation[`a${sep}b${sep}yyyy`] = decision;
        if (decision.orientation === "unresolved" || group.length === 0) continue;

        const pick = decision.orientation === "day-first" ? "dayFirst" : "monthFirst";
        const byRow = new Map(group.map(t => [t.rowIndex, t]));
        for (const scannedRow of scanned) {
            const token = byRow.get(scannedRow.rowIndex);
            if (!token) continue;
            scannedRow.canonical = readAmbiguous(token)[pick];
        }
    }

    // ── Pass 2.5: put back the days Excel's locale mis-parsed ──
    // Consecutive rows carrying the same value are one group and are always read
    // the same way.
    const repairRuns: RepairRun[] = [];
    for (const entry of scanned) {
        if (!entry.canonical) continue;
        const last = repairRuns[repairRuns.length - 1];
        if (last && last.base === entry.canonical && last.interpreted === entry.interpreted) {
            last.rowIndexes.push(entry.rowIndex);
            continue;
        }
        repairRuns.push({
            rowIndexes: [entry.rowIndex],
            base: entry.canonical,
            interpreted: entry.interpreted,
            alternative: entry.interpreted ? transposeMonthDay(entry.canonical) : null,
        });
    }

    let repairedDateRows = 0;
    let repairNote: string | null = null;
    const repair = planDateRepair(repairRuns);
    if (repair) {
        const byRow = new Map(scanned.map(s => [s.rowIndex, s]));
        let repairedRuns = 0;
        for (let i = 0; i < repairRuns.length; i++) {
            if (repair.picks[i] === 0) continue;
            const corrected = repairRuns[i].alternative as CanonicalDate;
            repairedRuns++;
            for (const rowIndex of repairRuns[i].rowIndexes) {
                const entry = byRow.get(rowIndex);
                if (entry) { entry.canonical = corrected; repairedDateRows++; }
            }
        }
        if (repairedDateRows > 0) {
            repairNote =
                `${repairedDateRows} row(s) in ${repairedRuns} date group(s) were stored by Excel with the day and ` +
                `month transposed; they have been read the way the sheet is written, which puts the whole ` +
                `column back in date order.`;
        }
    }

    // ── Pass 3: blocks, inheritance and validation ──
    // Rows are grouped into blocks of consecutive non-blank rows: that is the
    // structure these sheets actually use to mark one day's work. A date is only
    // ever inherited inside such a block (or from a merge), never across the
    // blank row that separates two days, and never from "today".
    const rowsOut: MarketingImportRow[] = [];
    const rejects: RejectedRow[] = [];
    let blankRowsSkipped = 0;
    let missingDateRows = 0;
    let inheritedDateRows = 0;

    let i = 0;
    while (i < scanned.length) {
        if (scanned[i].blank) { blankRowsSkipped++; i++; continue; }

        const start = i;
        while (i < scanned.length && !scanned[i].blank) i++;
        const block = scanned.slice(start, i);

        const blockDates = block.map(b => b.canonical).filter((d): d is CanonicalDate => !!d);
        const soleBlockDate = new Set(blockDates).size === 1 ? blockDates[0] : null;
        const blockNames = block.map(b => b.name).filter(n => n !== "");
        const soleBlockName = new Set(blockNames).size === 1 ? blockNames[0] : null;

        let dateAbove: CanonicalDate | null = null;
        let nameAbove = "";

        for (const entry of block) {
            if (entry.canonical) dateAbove = entry.canonical;
            if (entry.name) nameAbove = entry.name;

            const inheritedDate = entry.canonical ?? dateAbove ?? soleBlockDate;
            const name = entry.name || nameAbove || soleBlockName || "";

            const hasLeadInfo = entry.companyName !== "" || entry.link !== "";
            if (!hasLeadInfo) {
                rejects.push({ excelRow: entry.rowIndex + 1, reason: "no-lead-info" });
                continue;
            }

            // A date that exists but cannot be read is never guessed at: the row
            // is reported instead of being imported on the wrong calendar day.
            if (entry.token.kind === "unreadable") {
                rejects.push({ excelRow: entry.rowIndex + 1, reason: "unreadable-date", rawDate: String(entry.rawDate) });
                continue;
            }
            if (entry.token.kind === "ambiguous" && !entry.canonical) {
                rejects.push({ excelRow: entry.rowIndex + 1, reason: "ambiguous-date", rawDate: String(entry.rawDate) });
                continue;
            }

            if (!inheritedDate) missingDateRows++;
            else if (!entry.canonical) inheritedDateRows++;

            rowsOut.push({
                name: name || "Unknown Candidate",
                date: inheritedDate,
                companyName: entry.companyName,
                link: entry.link,
                excelRow: entry.rowIndex + 1,
                dateInherited: !entry.canonical && !!inheritedDate,
            });
        }
    }

    const samples = rowsOut.slice(0, 5).map(r => {
        const source = scanned.find(s => s.rowIndex === r.excelRow - 1);
        return {
            excelRow: r.excelRow,
            raw: source?.rawDate,
            rawType: source?.rawDate instanceof Date ? "Date" : typeof source?.rawDate,
            canonical: r.date,
        };
    });

    return {
        ok: true,
        rows: rowsOut,
        diagnostics: {
            sheetName,
            headerRowIndex,
            headers: headerRow.map(h => text(h)),
            columns: {
                name: columns.name, date: columns.date,
                companyName: columns.companyName, link: columns.link,
            },
            extraColumns,
            rowsScanned: scanned.length,
            blankRowsSkipped,
            validRows: rowsOut.length,
            rejectedRows: rejects.length,
            missingDateRows,
            inheritedDateRows,
            repairedDateRows,
            repairNote,
            dateValueKinds,
            dateOrientation,
            usesDate1904: date1904,
            mergedDateCells,
            samples,
            rejects,
        },
    };
}

// ── Display helpers (kept here so import and UI share one calendar) ───────────

/**
 * Canonical "YYYY-MM-DD" → "DD/MM/YYYY", by string surgery only. No Date object
 * is constructed, so the displayed day always matches the stored day.
 */
export function formatCanonicalDate(value: unknown): string {
    if (value === null || value === undefined) return "-";
    const str = String(value).trim();
    if (str === "") return "-";

    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

    // Legacy rows that were stored as DD/MM/YYYY already display correctly.
    const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) return `${pad2(+slash[1])}/${pad2(+slash[2])}/${slash[3]}`;

    return str;
}

/**
 * Normalise a stored value to canonical form for sorting/filtering. Canonical
 * strings compare correctly with plain string comparison, so no Date maths —
 * and therefore no timezone — is involved anywhere in the table.
 */
export function toCanonicalForCompare(value: unknown): string {
    if (value === null || value === undefined) return "";
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) return `${slash[3]}-${pad2(+slash[2])}-${pad2(+slash[1])}`;
    return "";
}
