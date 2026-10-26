import { readFileSync } from "fs";
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function rest(path) {
  const res = await fetch(`${base}/rest/v1/${path}`, { headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

console.log("=== 1. shifts table — expect exactly 3 rows, correct values ===");
const shifts = await rest("shifts?select=*&order=sort_order.asc");
console.log(shifts.status, JSON.stringify(shifts.body, null, 2));

console.log("\n=== 2. profiles.shift_id — total count and null-coverage ===");
const total = await rest("profiles?select=id");
const missing = await rest("profiles?select=id,full_name,role,designation&shift_id=is.null");
console.log("Total profiles:", Array.isArray(total.body) ? total.body.length : total.body);
console.log("Profiles still missing shift_id (expect []):", JSON.stringify(missing.body));

console.log("\n=== 3. Backfill correctness — every profile's shift_id vs its role/designation ===");
const all = await rest("profiles?select=id,full_name,role,designation,shift_id");
const NIGHT = "a1000000-0000-4000-8000-000000000001";
const IMMIGRATION = "a1000000-0000-4000-8000-000000000002";
let mismatches = [];
for (const p of all.body) {
  const shouldBeImmigration = p.role === "IMMIGRATION" || p.designation === "Immigration HR";
  const expected = shouldBeImmigration ? IMMIGRATION : NIGHT;
  if (p.shift_id !== expected) {
    mismatches.push({ name: p.full_name, role: p.role, designation: p.designation, shift_id: p.shift_id, expected });
  }
}
console.log("Mismatches (expect none):", JSON.stringify(mismatches, null, 2));
console.log(`Checked ${all.body.length} profiles, ${mismatches.length} mismatches.`);

console.log("\n=== 4. clock_in() RPC — unauthenticated call should hit the new function cleanly (not a stale/missing-column error) ===");
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const rpcRes = await fetch(`${base}/rest/v1/rpc/clock_in`, {
  method: "POST",
  headers: { apikey: anonKey, "Content-Type": "application/json" },
  body: "{}",
});
const rpcBody = await rpcRes.json();
console.log(rpcRes.status, JSON.stringify(rpcBody));
