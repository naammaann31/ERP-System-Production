// Excel import parsing for the Sales module (sales_leads).
//
// Deliberately a separate, purpose-built parser rather than reuse of
// marketingExcelImport.ts's heavier ambiguous-date-repair logic — the real
// files this reads from (Master Data.xlsx, each employee's own lead sheet)
// are machine-exported with real Excel date cells, not user-typed ambiguous
// text, so the hard problem Marketing's importer solves doesn't apply here.
// This module only parses a workbook into structured rows; de-duplication
// against the database and custom-column registration both need a live
// Supabase client, so (matching marketingExcelImport.ts's own split) those
// stay in the calling component, not here.

export type SalesLeadStatus =
  | "Attempt 1"
  | "Attempt 2"
  | "Attempt 3"
  | "Follow up requested"
  | "Interested"
  | "Not interested"
  | "Meeting scheduled"
  | "Closed"
  | "Dead Lead";

export const SALES_LEAD_STATUSES: SalesLeadStatus[] = [
  "Attempt 1",
  "Attempt 2",
  "Attempt 3",
  "Follow up requested",
  "Interested",
  "Not interested",
  "Meeting scheduled",
  "Closed",
  "Dead Lead",
];

export const SALES_VISA_OPTIONS = [
  "CPT",
  "OPT",
  "STEM OPT",
  "CITIZEN",
  "GREEN CARD",
  "WORK PERMIT",
  "PR",
  "H4EAD",
  "H-1B",
  "Others",
];

export interface ParsedSalesLeadRow {
  name: string;
  mobile: string;
  email: string;
  linkedin_url: string;
  visa: string | null;
  status: SalesLeadStatus | null;
  country: string | null;
  remarks: string | null;
  entry_date: string; // YYYY-MM-DD
  assigned_to_name: string | null; // raw "Assigned To" text, resolved to a uid by the caller
  custom_fields: Record<string, string>;
  source_row_number: number; // 0-based index into the sheet's data rows, for import-batch idempotency
}

export interface ParseSalesWorkbookResult {
  rows: ParsedSalesLeadRow[];
  newCustomColumns: { key: string; label: string }[]; // headers that didn't match a known field
  skippedNoName: number;
}

// Known header aliases, lower-cased/trimmed for matching. A column whose
// header doesn't match any of these becomes a custom field instead of
// being silently dropped - this is what lets an importer's one-off column
// (e.g. "Graduation", seen in the real source files) survive the import as
// a private custom column rather than being lost.
const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "candidate name", "full name"],
  mobile: ["contact", "mobile", "phone", "contact number", "phone number", "number"],
  email: ["email", "e-mail", "email address"],
  linkedin_url: ["url", "linkedin", "linkedin url", "linkedin profile url", "profile url"],
  visa: ["visa", "visa status"],
  status: ["status"],
  country: ["country"],
  remarks: ["remarks", "feedback", "notes", "follow ups", "follow up", "comment", "comments"],
  entry_date: ["date"],
  assigned_to_name: ["assigned to", "assignedto", "assigned"],
};

function normalizeHeader(h: any): string {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function slugifyHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "field";
}

function matchKnownField(normalizedHeader: string): string | null {
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(normalizedHeader)) return field;
  }
  return null;
}

/** Excel serial date (days since 1899-12-30) -> "YYYY-MM-DD". */
function excelSerialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return d.toISOString().split("T")[0];
}

// Same tolerance marketingExcelImport.ts's jsDateToCanonical uses for the
// identical problem - real source files' date-only cells sometimes land a
// few seconds shy of true local midnight (confirmed live: a constant
// 23:59:50-local artifact on every row of a real sheet, not random
// jitter), and local getters alone read that as the day before.
const MIDNIGHT_SNAP_MS = 15 * 60 * 1000;

/**
 * Extracts the calendar date from a JS Date using LOCAL getters, never
 * toISOString() (UTC). The `xlsx` library's cellDates:true conversion
 * anchors a date-only cell to local midnight of the day Excel displays,
 * so reading it back via toISOString() in any timezone ahead of UTC (IST
 * included) silently returns the day BEFORE the one shown in the sheet -
 * confirmed live: every single date in a real import came out one day
 * early. Local getters alone are not enough either: a cell landing a few
 * seconds BEFORE local midnight (also confirmed live) still reads back as
 * the day before even via local getters, so the near-midnight time-of-day
 * is snapped to the nearer boundary first.
 */
function localDateToIso(value: Date): string {
  let d = value;
  const msIntoDay =
    value.getHours() * 3600000 + value.getMinutes() * 60000 +
    value.getSeconds() * 1000 + value.getMilliseconds();
  const msToMidnight = 86400000 - msIntoDay;
  if (msToMidnight <= MIDNIGHT_SNAP_MS) d = new Date(value.getTime() + msToMidnight);
  else if (msIntoDay <= MIDNIGHT_SNAP_MS) d = new Date(value.getTime() - msIntoDay);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIsoDate(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return localDateToIso(value);
  }
  if (typeof value === "number") {
    return excelSerialToIso(value);
  }
  const str = String(value).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return localDateToIso(parsed);
  return null;
}

function toStatus(value: any): SalesLeadStatus | null {
  const str = String(value ?? "").trim();
  if (!str) return null;
  const match = SALES_LEAD_STATUSES.find((s) => s.toLowerCase() === str.toLowerCase());
  return match ?? null;
}

/** Strips everything but digits, then drops a leading US country-code "1" on an 11-digit number — the normalized form used ONLY for duplicate comparison, never for storage/display. */
export function normalizePhoneForCompare(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeEmailForCompare(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase();
}

/**
 * Parses a workbook's first sheet (or `sheetName` if given) into structured
 * rows. `todayIso` is the fallback entry_date for a row with a blank Date
 * column, passed in by the caller (not computed here) so this stays a pure
 * function with no Date.now()/timezone surprises of its own.
 */
export function parseSalesLeadsWorkbook(
  workbook: any,
  todayIso: string,
  sheetName?: string
): ParseSalesWorkbookResult {
  const sn = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sn];
  if (!sheet) return { rows: [], newCustomColumns: [], skippedNoName: 0 };
  return parseSheetRows(sheet, todayIso);
}

function parseSheetRows(sheet: any, todayIso: string): ParseSalesWorkbookResult {
  // Lazily require xlsx only for the sheet_to_json call so this module has
  // no hard import-time dependency on it beyond what the caller already
  // loaded (mirrors how marketingExcelImport.ts is handed a workbook/sheet
  // rather than reading the file itself).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require("xlsx");
  // raw: true is required, not optional — with raw: false, XLSX converts
  // every cell (including real Date cells) into its DISPLAY-FORMATTED
  // STRING, discarding the actual Date object the caller's cellDates: true
  // read produced. That string then has to be re-parsed by toIsoDate()'s
  // ambiguous new Date(str) fallback, which can silently misread or reject
  // a perfectly valid date depending on its display format — this was the
  // exact cause of imported dates coming out wrong. raw: true preserves
  // the real Date object so toIsoDate() hits its correct, unambiguous
  // `instanceof Date` branch instead.
  const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const rows: ParsedSalesLeadRow[] = [];
  const newCustomColumns: { key: string; label: string }[] = [];
  const seenCustomKeys = new Set<string>();
  let skippedNoName = 0;

  if (grid.length === 0) return { rows, newCustomColumns, skippedNoName };

  // Header row: the first non-empty row.
  let headerRowIdx = 0;
  while (headerRowIdx < grid.length && grid[headerRowIdx].every((c) => String(c ?? "").trim() === "")) {
    headerRowIdx++;
  }
  const headerRow = grid[headerRowIdx] || [];

  // column index -> { field } | { customKey, customLabel }
  const columnMap: { field?: string; customKey?: string; customLabel?: string }[] = headerRow.map((raw) => {
    const normalized = normalizeHeader(raw);
    if (!normalized) return {};
    const field = matchKnownField(normalized);
    if (field) return { field };
    const label = String(raw).trim();
    const key = slugifyHeader(label);
    if (!seenCustomKeys.has(key)) {
      seenCustomKeys.add(key);
      newCustomColumns.push({ key, label });
    }
    return { customKey: key, customLabel: label };
  });

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const rawRow = grid[r] || [];
    if (rawRow.every((c) => String(c ?? "").trim() === "")) continue; // blank row

    const fields: Record<string, any> = {};
    const customFields: Record<string, string> = {};

    columnMap.forEach((col, idx) => {
      const value = rawRow[idx];
      if (value === undefined || value === null || String(value).trim() === "") return;
      if (col.field) {
        fields[col.field] = value;
      } else if (col.customKey) {
        customFields[col.customKey] = String(value).trim();
      }
    });

    const name = String(fields.name ?? "").trim();
    if (!name) {
      skippedNoName++;
      continue;
    }

    // sales_leads.status has a database check constraint limiting it to the
    // 9 canonical values above - a sheet's Status cell holding other real
    // work (e.g. "Call back") can't be stored there as-is without either
    // expanding that fixed list (a bigger, separate decision) or losing it
    // silently. Folding it into Remarks instead means that work survives
    // the import rather than vanishing the moment it doesn't match a known
    // status word.
    const rawStatusText = fields.status !== undefined && fields.status !== null ? String(fields.status).trim() : "";
    const recognizedStatus = toStatus(fields.status);
    let remarksText = fields.remarks ? String(fields.remarks).trim() : "";
    if (rawStatusText && !recognizedStatus) {
      remarksText = remarksText ? `${remarksText} | Status: ${rawStatusText}` : `Status: ${rawStatusText}`;
    }

    rows.push({
      name,
      mobile: String(fields.mobile ?? "").trim(),
      email: String(fields.email ?? "").trim(),
      linkedin_url: String(fields.linkedin_url ?? "").trim(),
      visa: fields.visa ? String(fields.visa).trim() : null,
      status: recognizedStatus,
      country: fields.country ? String(fields.country).trim() : null,
      remarks: remarksText || null,
      entry_date: toIsoDate(fields.entry_date) || todayIso,
      assigned_to_name: fields.assigned_to_name ? String(fields.assigned_to_name).trim() : null,
      custom_fields: customFields,
      source_row_number: r,
    });
  }

  return { rows, newCustomColumns, skippedNoName };
}
