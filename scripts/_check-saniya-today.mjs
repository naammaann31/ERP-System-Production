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
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}
const profiles = await rest(`profiles?full_name=ilike.*Saniya Banu*&select=id,full_name,role,designation`);
console.log("Profile:", profiles);
const uid = profiles[0].id;
const rows = await rest(`attendance?user_id=eq.${uid}&date=eq.2026-10-22&select=*`);
console.log("\nToday's row:", JSON.stringify(rows, null, 2));

const d = new Date(Date.UTC(2026, 9, 22)); // month is 0-indexed: 9=October
console.log("\n2026-10-22 day of week (0=Sun..6=Sat):", d.getUTCDay());
