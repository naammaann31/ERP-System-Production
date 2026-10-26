/**
 * Integration tests for the clock_in() / clock_out() Postgres RPCs
 * (supabase/migrations/00000000000033_server_side_clock_in_out.sql).
 *
 * ============================================================================
 * NOT YET EXECUTED. Do not run this against the production database.
 * ============================================================================
 *
 * Requires, before it can run at all:
 *   1. Migration 00000000000033 actually applied to the target database.
 *   2. A DEDICATED TEST PROFILE (not a real employee) in that database,
 *      with its own Supabase Auth user so a real session JWT can be
 *      obtained — these RPCs read auth.uid() from the session, they
 *      cannot be exercised meaningfully with the service-role key alone
 *      (that key has no auth.uid() at all, so "not authenticated" would
 *      be the only reachable path).
 *   3. TEST_USER_EMAIL / TEST_USER_PASSWORD for that dedicated test
 *      profile, supplied via environment variables — never hardcoded.
 *   4. A second such test profile for the "cannot clock out another
 *      employee's record" case.
 *
 * Recommended safe environment: a separate Supabase project, or a
 * Supabase branch/staging database if available, NOT the live project
 * this repo's .env.local points at. If no such environment exists, this
 * file documents exactly what would need to be verified, without being
 * run anywhere that could touch real attendance data.
 *
 * This script will refuse to run unless RUN_ATTENDANCE_RPC_TESTS=yes is
 * explicitly set, as a deliberate guard against accidental execution.
 */

if (process.env.RUN_ATTENDANCE_RPC_TESTS !== "yes") {
  console.log(
    "Refusing to run: set RUN_ATTENDANCE_RPC_TESTS=yes (and point SUPABASE env vars at a safe, non-production database with a dedicated test profile) to actually execute these."
  );
  process.exit(1);
}

import { readFileSync } from "fs";
const envText = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const base = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;
const TEST_USER_2_EMAIL = process.env.TEST_USER_2_EMAIL;
const TEST_USER_2_PASSWORD = process.env.TEST_USER_2_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  console.log("Missing TEST_USER_EMAIL / TEST_USER_PASSWORD for a dedicated test profile. Not running.");
  process.exit(1);
}

async function signIn(email, password) {
  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  return res.json(); // { access_token, ... }
}

async function callRpc(fnName, accessToken, args = {}) {
  const res = await fetch(`${base}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

let total = 0, failed = 0;
function check(name, cond) {
  total++;
  if (!cond) { failed++; console.log(`[FAIL] ${name}`); }
  else console.log(`[PASS] ${name}`);
}

const session = await signIn(TEST_USER_EMAIL, TEST_USER_PASSWORD);
const token = session.access_token;

// --- Unauthenticated call ---
{
  const r = await callRpc("clock_in", "invalid-token-not-a-real-jwt");
  check("Unauthenticated clock_in is rejected (not 200 with a row)", r.status !== 200 || !r.body?.id);
}

// --- Basic clock-in ---
const first = await callRpc("clock_in", token);
check("First clock_in succeeds and returns a row", first.status === 200 && !!first.body?.id);
check("Status is Checked In or Absent (never something else) on insert", ["Checked In", "Absent"].includes(first.body?.status));

// --- Duplicate clock-in is idempotent (same row, not a second insert) ---
const second = await callRpc("clock_in", token);
check("Duplicate clock_in returns the SAME row id (no duplicate insert)", second.body?.id === first.body?.id);

// --- Concurrent clock-in: fire two at once, expect exactly one distinct row ---
const [c1, c2] = await Promise.all([callRpc("clock_in", token), callRpc("clock_in", token)]);
check("Concurrent clock_in calls converge on one row id", c1.body?.id === c2.body?.id);

// --- Clock out on another employee's record should be rejected ---
if (TEST_USER_2_EMAIL && TEST_USER_2_PASSWORD) {
  const session2 = await signIn(TEST_USER_2_EMAIL, TEST_USER_2_PASSWORD);
  const r = await callRpc("clock_out", session2.access_token, { p_attendance_id: first.body.id });
  check("Second employee cannot clock out the first employee's record", r.status >= 400);
} else {
  console.log("[SKIP] Cross-employee clock_out test — TEST_USER_2_EMAIL/PASSWORD not set.");
}

// --- Normal clock-out ---
const out1 = await callRpc("clock_out", token, { p_attendance_id: first.body.id });
check("clock_out succeeds", out1.status === 200 && out1.body?.status === "Present");

// --- Duplicate clock-out is idempotent (returns the already-closed row, no error) ---
const out2 = await callRpc("clock_out", token, { p_attendance_id: first.body.id });
check("Duplicate clock_out returns the same closed row without error", out2.status === 200 && out2.body?.id === first.body.id);

// --- Clock out on a nonexistent record ---
const missing = await callRpc("clock_out", token, { p_attendance_id: "00000000-0000-0000-0000-000000000000" });
check("clock_out on a missing record errors cleanly (no stack trace / schema leak)", missing.status >= 400);

console.log(`\n${total - failed}/${total} passed.`);
if (failed > 0) process.exit(1);
