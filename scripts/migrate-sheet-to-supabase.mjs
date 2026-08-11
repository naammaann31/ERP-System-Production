// One-time: move the Interview & Screening Google Sheet contents into
// Supabase so the tab no longer depends on the sheet.
//
//   node scripts/migrate-sheet-to-supabase.mjs --dry-run
//   node scripts/migrate-sheet-to-supabase.mjs
import fs from "node:fs";
import * as xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(".env.local");

const DRY = process.argv.includes("--dry-run");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- 1. Read the sheet (same parse as the server action) ----
const ID = "1am7rFQV4dZgdwWqGisZh3zMbgKprfYp64R_uaQ93nVA";
const res = await fetch(`https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=868230713`, { cache: "no-store" });
if (!res.ok || !(res.headers.get("content-type") || "").includes("csv")) {
  console.error("Could not read the sheet as CSV:", res.status, res.headers.get("content-type"));
  process.exit(1);
}
const wb = xlsx.read(await res.arrayBuffer(), { type: "array" });
const grid = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", blankrows: true });
const cell = (r, i) => String(r?.[i] ?? "").trim();
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const sheetRows = [];
for (let r = 2; r < grid.length; r++) {
  const row = grid[r] || [];
  if ([0, 1, 2, 3, 4, 5].some((c) => cell(row, c) !== "")) {
    sheetRows.push({
      section: "interview",
      sig: [0, 1, 2].map((i) => norm(cell(row, i))).join("|"),
      entry_date: cell(row, 0), candidate: cell(row, 1), client: cell(row, 2),
      stage: cell(row, 3), recruiter: cell(row, 4), remarks: cell(row, 5),
    });
  }
  if ([6, 7, 8, 9, 10, 11].some((c) => cell(row, c) !== "")) {
    sheetRows.push({
      section: "screening",
      sig: [6, 7, 8].map((i) => norm(cell(row, i))).join("|"),
      entry_date: cell(row, 6), candidate: cell(row, 7), client: cell(row, 8),
      stage: cell(row, 9), recruiter: cell(row, 10), remarks: cell(row, 11),
    });
  }
}
const iCount = sheetRows.filter((r) => r.section === "interview").length;
console.log(`Sheet: ${iCount} interview + ${sheetRows.length - iCount} screening = ${sheetRows.length} rows`);

// ---- 2. Apply any ERP remark overrides on top ----
const { data: overrides } = await admin.from("interview_screening_remarks").select("row_sig, remark");
console.log(`Remark overrides stored in ERP: ${overrides?.length ?? 0}`);
const overrideMap = new Map((overrides || []).map((o) => [o.row_sig, o.remark]));
let applied = 0;
sheetRows.forEach((r) => {
  if (overrideMap.has(r.sig)) { r.remarks = overrideMap.get(r.sig); applied++; }
});
console.log(`Overrides applied to sheet rows: ${applied}`);

// ---- 3. Inspect what's already in the table ----
const { data: existing } = await admin.from("interview_screening_entries").select("*");
console.log(`\nExisting ERP rows: ${existing.length}`);

const sheetCandidateKeys = new Set(sheetRows.map((r) => `${r.section}|${norm(r.candidate)}|${norm(r.client)}`));
const dupes = existing.filter((e) => sheetCandidateKeys.has(`${e.section}|${norm(e.candidate)}|${norm(e.client)}`));
const keep = existing.filter((e) => !sheetCandidateKeys.has(`${e.section}|${norm(e.candidate)}|${norm(e.client)}`));

console.log(`  duplicates of sheet rows (will be removed): ${dupes.length}`);
dupes.forEach((d) => console.log(`     [${d.section}] ${d.candidate} | ${d.client} | date="${d.entry_date}"`));
console.log(`  unique ERP rows (will be KEPT): ${keep.length}`);
keep.forEach((k) => console.log(`     [${k.section}] ${k.candidate} | ${k.client} | date="${k.entry_date}"`));

if (DRY) {
  console.log("\n--- DRY RUN: nothing written. Re-run without --dry-run to apply. ---");
  process.exit(0);
}

// ---- 4. Remove duplicates, then insert the sheet rows ----
if (dupes.length) {
  const { error } = await admin.from("interview_screening_entries").delete().in("id", dupes.map((d) => d.id));
  if (error) { console.error("delete failed:", error); process.exit(1); }
  console.log(`\nRemoved ${dupes.length} duplicate row(s).`);
}

const payload = sheetRows.map(({ sig, ...r }) => ({ ...r, created_by_name: r.recruiter || "Imported from sheet" }));
const CHUNK = 400;
let inserted = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const { data, error } = await admin.from("interview_screening_entries").insert(payload.slice(i, i + CHUNK)).select();
  if (error) { console.error("insert failed:", error); process.exit(1); }
  inserted += data.length;
}
console.log(`Inserted ${inserted} sheet row(s) into Supabase.`);

const { data: final } = await admin.from("interview_screening_entries").select("section");
const bySec = {};
final.forEach((r) => { bySec[r.section] = (bySec[r.section] || 0) + 1; });
console.log("\nFinal table:", bySec, "| total:", final.length);
