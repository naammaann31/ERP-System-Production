@AGENTS.md

# Vectra ERP — Project Knowledge Base

**Last audited:** 2026-10-09
**Audit scope:** Full repository inspection (migrations, RLS policies, `app/`, `components/`, `lib/`, `package.json`), plus everything independently verified in prior work sessions against the **live** Supabase project (not just source). Where a claim is based only on source code and not cross-checked against the live database, it is labeled accordingly. This document supersedes `Vectra_ERP_System_Complete_Documentation.txt` and `Vectra_ERP_Data_Flow_Documentation.docx`, which describe a **stale Firebase/Firestore architecture** the project has since migrated away from — do not trust those two files for anything about how the app works today; they are kept only as historical artifacts.

This file documents the project as it exists. It does not propose fixes. Where a problem is noted, it is flagged for a future session to decide on, not silently corrected here.

---

## 1. Project Identity

**Vectra ERP** (`package.json` name: `vectra_crm`) — an internal HR/operations ERP for **Vectra Group / Vectra Staffing LLC**, a staffing/recruiting company. It covers employee records, attendance (with night-shift and morning/immigration-shift rules), leave, payroll, a Marketing lead-tracking + Excel-import pipeline, an Interview & Screening tracker, a Candidates (recruitment) tracker, Sales/Operations lead tracking, documents, announcements, and notifications.

**Verified:** Originally built on Firebase/Firestore + Cloud Functions, then migrated to Next.js + Supabase (Postgres). The migration is **complete** for application code — no live Firebase SDK calls were found anywhere in `app/`, `components/`, or `lib/`. The only remaining trace of Firebase is cosmetic: `salesMarketingMap.ts` still shapes `createdAt` as `{ seconds: ... }` (a Firestore Timestamp-like shape) for backward compatibility with UI code, even though the underlying value is now a Postgres `timestamptz` string.

---

## 2. Quick Start

```bash
npm install
npm run dev     # next dev -H 0.0.0.0  (binds all interfaces, not just localhost)
npm run build   # next build
npm run start   # next start (production server)
npm run lint    # eslint
```

- No `test` script exists in `package.json`. **Not implemented**: there is no test suite, no test runner configured, no CI workflow file found in the repo. One ad-hoc manual-verification script exists at the repo root, `test-working-seconds.ts` — not wired to any runner, just a `console.log`-based script a developer ran manually to sanity-check `computeWorkedSeconds()` against the 5:00 AM auto-clock-out cutoff. `playwright` is a devDependency but no `*.spec.ts`/playwright config or test files were found anywhere outside `node_modules` — **unverified** what it was added for; possibly unused or planned-but-abandoned.
- Database migrations live in `supabase/migrations/*.sql`, applied manually by the project owner through the Supabase SQL editor (no CI/CD migration pipeline found). They are **not** auto-applied — this agent has observed migrations being written and the user confirming separately that they ran them.
- Environment variables (names only, verified from source — **never** put actual values in this file):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by both the browser client (`lib/supabase/client.ts`) and the cookie-aware server client (`lib/supabase/server.ts`).
  - `SUPABASE_SERVICE_ROLE_KEY` — used server-side only, by `lib/supabase/server.ts`'s `createServiceRoleClient()`, by `app/actions/marketing.ts`, `app/actions/payroll.ts`, and `app/api/cron/auto-clock-out/route.ts`. **Never** reference this from a `"use client"` file.
  - `CRON_SECRET` — bearer-token check in `app/api/cron/auto-clock-out/route.ts`; if unset, the check is skipped entirely (see §10).
  - SMTP-related vars consumed by `app/api/send-leave-email/route.ts` (exact names not re-verified this pass; see §10 — this route is a known, previously-identified security gap, deliberately left unfixed per explicit prior instruction from the project owner).

---

## 3. Technology Stack (verified from `package.json`)

| Layer | Technology | Version | Where it matters |
|---|---|---|---|
| Framework | Next.js | `16.2.9` | App Router only (no `pages/` dir found). **Note:** `AGENTS.md` explicitly warns this Next.js version has breaking changes vs. training-data assumptions — consult `node_modules/next/dist/docs/` before writing framework-level code. |
| UI runtime | React | `19.2.4` | |
| Language | TypeScript | `^5` | `tsconfig.json` present; `npx tsc --noEmit -p tsconfig.json` is the standard verification command used throughout this project's history. |
| Styling | Tailwind CSS | `^4` (`@tailwindcss/postcss`) | |
| Backend/DB | Supabase (Postgres + Auth + Storage + Realtime) | `@supabase/supabase-js ^2.112.3`, `@supabase/ssr ^0.12.4` | See §12/§13. |
| Forms | `react-hook-form` + `@hookform/resolvers` + `zod` | | Used selectively, not universally — many forms (e.g. Marketing's inline Add Data) are plain controlled `useState`, not RHF. |
| Excel | `xlsx`, `xlsx-js-style` | | `xlsx` for all parsing (Marketing, Candidates, Interview&Screening, Operations imports) and for Export XL; `xlsx-js-style` not confirmed in active use this pass — **requires investigation**. |
| PDF/Docs | `jspdf` + `html2canvas`, `docx` | | `jspdf`/`html2canvas` back `components/payroll/PayslipDocument.tsx` (payslip generation). `docx` (devDependency) — usage not traced this pass. |
| Email | `nodemailer` | | Used by `app/api/send-leave-email/route.ts`. |
| Animation | `framer-motion` | | Used pervasively across dashboard components for mount transitions. |
| Toasts | `sonner` | | App-wide toast notifications. |
| Dates | `date-fns` | | |
| Icons | `lucide-react` | | |
| Realtime UI | Supabase Realtime (`postgres_changes` channels) | | Used extensively — see §19. |

No state-management library (Redux/Zustand/etc.) — state is local `useState`/`useEffect` per component plus three React Context providers (`AuthProvider`, `SidebarProvider`, `NotificationProvider`). No data-fetching/caching library (no React Query/SWR) — every component manages its own fetch + Realtime subscription lifecycle by hand.

---

## 4. Repository Structure

```
app/
  (auth)/login/page.tsx          — login screen, outside the dashboard layout
  actions/                       — Next.js Server Actions ("use server")
    employees.ts                 — create/update/delete employee (Auth + profile)
    marketing.ts                 — Google-Sheet fetch (legacy), Daily Report CRUD, Interview/Screening breakdown
    payroll.ts                   — payroll extra-field writes, bank-name/profile lookups
  api/
    cron/auto-clock-out/route.ts — scheduled auto-clock-out for missed check-outs
    send-leave-email/route.ts    — leave-approval email notification
  dashboard/                     — every authenticated screen, wrapped by app/dashboard/layout.tsx -> ProtectedRoute
    (one subfolder per feature — see §6 Feature Inventory)
  layout.tsx, page.tsx            — root layout/landing

components/
  dashboard/                     — feature-specific dashboards (attendance/, leave/, payroll/, operations/, interviewScreening/, candidates/, marketing/)
  layout/                        — Sidebar, Navbar
  auth/ProtectedRoute.tsx        — client-side route gate (see §13)
  providers/                     — AuthProvider, SidebarProvider, NotificationProvider
  ui/                            — shared primitives (ConfirmModal, DatePicker, Card, Button, etc.)
  employees/                     — Add/Edit employee modals
  payroll/PayslipDocument.tsx    — PDF payslip renderer

lib/
  supabase/client.ts             — browser Supabase client (anon key)
  supabase/server.ts             — server Supabase client (cookie-based session) + createServiceRoleClient()
  supabase/middleware.ts         — updateSession() helper — ⚠️ see §13, this is NOT wired up anywhere
  supabase/requireSession.ts     — client-side "is there a session" guard used before writes
  attendance.ts                  — all attendance business logic (see §8.A)
  leave.ts                       — leave CRUD + accrual math (see §8.D)
  payroll.ts                     — payroll CRUD + LOP/leave calculation (see §8.D)
  marketingExcelImport.ts        — Marketing Leads importer (see §8.B) — the most heavily hardened file in the repo
  candidatesExcelImport.ts       — Candidates importer
  interviewScreeningExcelImport.ts — Interview & Screening importer
  operationsExcelImport.ts       — Sales/Operations importer (lighter-weight, different conventions — see §8.B)
  salesMarketingMap.ts           — snake_case DB row <-> legacy spreadsheet-key UI shape mapping
  marketingTeamLeadAccess.ts     — isMarketingTeamLead() + named-UID override (see §7)
  dateSort.ts                    — shared multi-format date comparator for Sales/Marketing/Interview&Screening tables
  documents.ts, announcements.ts, notifications.ts, audit.ts, settings.ts, auth.ts, holidays.ts — one file per simple CRUD feature, all following the same fromRow()/listenTo*() pattern

supabase/migrations/             — 24 files, see §11. Hand-written, sequentially numbered (two files share the "15" prefix — a real numbering collision, both apply, order between them is whatever the filesystem/tool returns them in; harmless since they touch unrelated functions).
```

Files found at the repo root that are **not** part of the application and should be ignored for architecture purposes: `Candidate_to_PMT_Replies.txt`, `PMT_to_Candidate_Emails.txt`, `pmt_progress_reports/*` (generated email text, looks like output from `generate_emails.py`/`generate_replies.py` — standalone Python scripts, not part of the Next.js app, **not traced this pass**), `Vectra Staffing LLC Employee Directory.xlsx`, `implementation_plan.md` (effectively empty/corrupted — two bytes of encoding artifact, no content).

---

## 5. Architecture Overview

- **Rendering:** Next.js App Router, almost entirely `"use client"` components doing their own Supabase queries directly from the browser (anon key) rather than Server Components fetching data. Server Actions (`app/actions/*.ts`) are used for a minority of operations — specifically ones that need the service-role key (bypass RLS) or Auth Admin API access.
- **Authorization model:** Row-Level Security (RLS) in Postgres is the primary enforcement layer for direct table reads/writes from the browser client. Server Actions that use `createServiceRoleClient()` bypass RLS entirely and **must** do their own caller-authorization check — **some do, some don't** (see §13, this is the single biggest class of confirmed finding in this audit).
- **Realtime:** Nearly every list view subscribes to a `postgres_changes` channel on its table and either (a) does a full refetch on any event ("reset" pattern — Marketing, Candidates, Interview & Screening all now use this with pagination) or (b) maintains an in-memory array patched directly from the payload (the simpler `lib/*.ts` `listenTo*()` helpers — leave, documents, announcements, notifications, audit logs).
- **Pagination:** Marketing Leads, Candidates, and Interview & Screening all use real server-side pagination (`.range()` + `count:"exact"`, `PAGE_SIZE = 100`, "Load More" button) — this was built incrementally across this project's history; earlier versions fetched entire tables client-side. Sales/Operations and the Daily Report list views do **not** have server-side pagination — **unverified** how large those tables currently are; flagged as a scaling risk if they grow the way Marketing did.
- **Excel import:** Four independent importer modules (Marketing, Candidates, Interview&Screening, Operations), each with its own header-detection and date-parsing logic — **not** a shared library, by deliberate design (each sheet's real-world quirks differ enough that a shared abstraction would be fighting itself). See §8.B for the specific, hard-won rules each one encodes.

---

## 6. Feature & Module Inventory

| Feature | Primary route(s) | Primary component(s) | Primary table(s) | Access |
|---|---|---|---|---|
| Auth / Login | `app/(auth)/login/page.tsx` | — | `auth.users`, `profiles` | Public (login form) |
| Dashboard home | `/dashboard` | `app/dashboard/page.tsx` + widgets | `attendance`, `notifications`, `announcements` | All authenticated |
| Employees directory | `/dashboard/employees`, `/dashboard/employees/[uid]` | `components/employees/*`, employee detail page | `profiles`, `employee_private`, `attendance`, `marketing`, `candidates` | Admin/HR full; Team-Lead can view individual profiles (see §13) |
| Departments | `/dashboard/departments`, `/dashboard/departments/[id]` | `components/dashboard/departments/SalesDataSection.tsx` + others | `sales`, `profiles` | Admin only (Sidebar-gated) |
| Attendance | `/dashboard/attendance` | `HRAttendanceDashboard.tsx` (Admin/HR/OPS_HR) / `EmployeeAttendanceDashboard.tsx` (everyone else) | `attendance` | Role-split at the page level; see §8.A |
| Leave | `/dashboard/leave` | `HRLeaveDashboard.tsx` / `EmployeeLeaveDashboard.tsx` | `leave_requests` | Role-split (Admin/HR vs. everyone else) |
| Payroll | `/dashboard/payroll` | `HRPayrollDashboard.tsx` / `EmployeePayrollDashboard.tsx` | `payrolls`, `salary_structures`, `employee_private` | Role-split; generation restricted to the `generate_payroll()` RPC |
| Daily Report (Marketing) | `/dashboard/daily-reports`, `/dashboard/daily-reports/marketing`, `/dashboard/my-team` | `app/dashboard/my-team/page.tsx`, `app/dashboard/daily-reports/marketing/page.tsx` | `marketing_daily_reports` (⚠️ not in any tracked migration — see §11), `interview_screening_entries` | Admin/HR + Marketing Team-Lead (+ named T&D override) |
| Daily Report (Sales) | `/dashboard/daily-reports/sales` | — | — | **Not traced this pass** — exists as a route but internals unverified |
| Marketing Leads Data | `/dashboard/data` (Leads tab) | `MarketingClient.tsx` | `marketing` | Admin, Marketing Team-Lead (+ override): all; regular employee: own rows only; HR: restricted to own (empty) by design per explicit project-owner decision — HR's Marketing visibility is meant to be Daily Reports only |
| Interview & Screening | `/dashboard/data` (I&S tab) | `InterviewScreeningClient.tsx` | `interview_screening_entries`, `interview_screening_remarks` | Marketing employees + Marketing Team-Lead + Admin — explicitly **not** HR (see §12) |
| Candidates | `/dashboard/candidates` | `CandidatesClient.tsx` | `candidates` | Assignee (own only) vs. Team-Lead/Admin/HR/OPS_HR (all) |
| Operations (Sales leads) | `/dashboard/operations` | `OperationsClient.tsx`, `OperationsForm.tsx` | `sales` | Admin/HR/Employee, department-gated to Sales |
| Documents | `/dashboard/documents` | — | `documents` (table) + `documents` (Storage bucket) | See §12 — table/bucket SELECT both currently unrestricted by role/scope at the RLS layer |
| Announcements | `/dashboard/announcements` | — | `announcements` | Read: everyone; write: Admin/HR |
| Settings | `/dashboard/settings` | — | `profiles` | Self |

---

## 7. Role & Permission Model

`profiles.role` is a single free-text column that conflates **organizational role** and **department** (confirmed by migration 1's own comment: *"role also carries department tags (MARKETING/SALES/IT/OPS_HR) matching legacy Firestore behavior"*). Observed/known values: `Admin`, `HR`, `OPS_HR`, `MARKETING`, `SALES`, `IT`, `IMMIGRATION`, and presumably others per department — **not exhaustively enumerated** anywhere in code as a fixed list/enum.

Three independent, **not always consistent**, places decide "who can do what" — a future agent changing access should check all three:

1. **Sidebar nav visibility** (`components/layout/Sidebar.tsx`) — collapses `profile.role` into just `"Admin" | "HR" | "OPS_HR"→"HR" | everything else→"Employee"` for most links, plus a separate `department` match (e.g. `"Marketing"`, `"Sales"`) for department-gated links, plus a separate `isTeamLeadOnly` flag for "My Team" (checks `designation === "Team-Lead" || jobRole === "Team-Lead" || designation === "Manager"`). **This is UI visibility only — not enforcement.**
2. **`ProtectedRoute.tsx`** (`components/auth/ProtectedRoute.tsx`) — client-side redirect guard, but only for three specific path prefixes: `/dashboard/employees` (Admin/HR only), `/dashboard/employees/[uid]` (Admin/HR or Team-Lead), `/dashboard/departments` (Admin only). **Every other route — including `/dashboard/my-team`, `/dashboard/daily-reports/*`, `/dashboard/attendance`, `/dashboard/leave`, `/dashboard/payroll` — has no route-level gate here**; they rely entirely on in-page checks (e.g. `my-team/page.tsx`'s own `router.push("/dashboard")` if not a Team-Lead/Manager) or on RLS.
3. **RLS policies** (`supabase/migrations/*.sql`) — the only layer that holds even if an attacker bypasses the UI entirely (e.g. via browser DevTools calling the Supabase REST API directly). See §12 for the full, table-by-table verified state.

**Known helper functions** (all `SECURITY DEFINER` SQL functions, callable from RLS policies):
- `is_admin()` — `role = 'Admin'`.
- `is_admin_or_hr()` — `role in ('Admin','HR','OPS_HR')`. Used as the "full visibility" gate on most tables.
- `is_admin_or_full_hr()` — narrower variant excluding OPS_HR, used specifically for attendance **edit** rights (migration 18) — OPS_HR can view attendance but not edit it.
- `is_marketing_team_lead()` — `role='MARKETING' AND (designation='Team-Lead' OR job_role='Team-Lead')`, **OR** `has_marketing_teamlead_override()`.
- `has_marketing_teamlead_override()` — a single hardcoded UID (`f84b92cc-7950-4304-b6e4-37b5056140aa`, documented in-migration as "Yudhisthir Soni — T&D Manager, Sales department") granted Marketing-Team-Lead-equivalent access without changing his actual role/department. This is a **named, individual exception** — not a general mechanism. See `lib/marketingTeamLeadAccess.ts` for the matching client-side mirror (`EXTRA_MARKETING_TEAM_LEAD_UIDS`), which must be kept in sync with the SQL function by hand (no shared source of truth between the two).
- `current_role_name()`, `current_designation()`, `current_job_role()` — simple lookups used throughout.

### Effective permission matrix (verified against current RLS + known UI gates)

| Resource | Owner/self | Regular employee (not owner) | Marketing Team-Lead (+ override) | Admin | HR | OPS_HR |
|---|---|---|---|---|---|---|
| Own attendance | Read/write own day | — | — | Read/write all | Read/write all | Read all, edit **restricted** (view-only, migration 18) |
| Someone else's attendance | — | **No** (fixed this session — was previously `using(true)`, open to everyone) | **No** (deliberately, per explicit project-owner decision — see §12) | Yes | Yes | Yes |
| Leave requests | Own | No | No | All | All | No (excluded from `HRLeaveDashboard`'s own role check, though `is_admin_or_hr()` at the RLS layer would technically still allow it — a UI/RLS looseness, not exploited by any current feature) |
| Marketing Leads | Own | No | **Yes, all** | Yes, all | No (intentionally — HR's Marketing visibility is Daily Reports only) | — |
| Interview & Screening | n/a (shared resource) | Read/add (all Marketing employees) | Read/add/edit/delete all | Read/edit/delete all | **No** (explicit, deliberate exclusion) | — |
| Candidates | Assigned only, read-only | n/a | All, full CRUD | All, full CRUD | All, full CRUD | All, full CRUD |
| Payroll | Own | No | No | All | All | **Unverified** — `is_admin_or_hr()` includes OPS_HR at the RLS layer; no UI gate specifically excludes them from `payrolls_select`, though `generate_payroll()` and the Payroll page's own role split were not re-verified this pass for OPS_HR specifically |
| Documents | Own + company-scope | **Metadata of ALL documents, including other people's "personal" scope** (see §12 — confirmed, not fixed) | — | All | All | — |

---

## 8. Critical Business Logic

### 8.A Attendance & Shift Management — **Verified against `lib/attendance.ts`, current as of this audit**

All attendance timestamps are intentionally pinned to **India Standard Time (`Asia/Kolkata`, fixed UTC+5:30, no DST)**, regardless of the employee's device timezone — this was a deliberate fix (see `IST_TIME_ZONE` constant and its doc comment: *"a laptop set to another timezone — or simply set wrong — records a different day and time from everyone else"*). However, this protects against **timezone misconfiguration**, not against a device's **absolute clock being wrong** — `new Date()` still reads the device's actual clock before IST-formatting is applied. This distinction was the subject of a real, unresolved investigation this session (see §15, Apoorv Giri attendance discrepancy) and remains a live limitation: attendance timestamps have **no server-stamped reference** to cross-check against (no `created_at` column on `attendance` at all — confirmed via live schema query).

**Two shift policies, selected by role/designation** (`checkIn()` in `lib/attendance.ts`):

| | Regular (default/night shift) | Immigration (`role='IMMIGRATION'` or `designation='Immigration HR'`) |
|---|---|---|
| Shift window | ~7:30 PM – 4:30 AM (not DB-enforced, just the expected pattern) | 10:00 AM – 6:00 PM |
| On-time cutoff | Late if clock-in > 7:45 PM, **or** if hour < 6 AM (treated as very-late/previous-night) | Late if clock-in > 10:15 AM |
| Late penalty | `is_half_day = true` automatically | same |
| Absent trigger | Clocking in between 12:00 AM–5:59 AM marks `status='Absent'` immediately on check-in (not just late) | handled by the cron only, not at check-in |
| Week-off | Not computed at check-in for regular shift | Sunday, or 4th Saturday of the month (`dayOfWeek===6 && dateNum between 22 and 28`) |
| Auto-clock-out cutoff (cron) | 5:00 AM IST the **following** calendar day | 6:45 PM same day (3:30 PM on Saturdays) |

**`getLocalDateString()`** — decides which calendar date a check-in belongs to. Current logic: plain IST calendar date, **except** if the IST hour is `< 6`, in which case it subtracts 6 hours before taking the date (rolls back to the previous day). **Discrepancy found and worth flagging explicitly:** migration `00000000000016_attendance_calendar_date.sql`'s own comment describes *removing* all such shift-window offset logic entirely (*"date is now simply the Indian calendar date of the check-in... no offset arithmetic"*), but the **current** `lib/attendance.ts` code still contains a narrower version of that offset (the `hour < 6` rollback). Either the migration's description is now stale relative to later code changes, or this is an unintentional regression — **not resolved in this audit, flagged for investigation**, since it directly affects which calendar day a night-shift employee's attendance is filed under.

**Early-leaver penalty** (`checkOut()`): if `workingSeconds < 5*3600` (5 hours), `is_half_day = true` — except Immigration employees on their week-off day, who are exempted from this penalty.

**`computeWorkedSeconds()`** — always **derived** from `checkInTime`/`checkOutTime` (or `Date.now()` if still checked in), never an incrementing counter — explicitly documented as a fix for timer-drift/double-counting bugs from an earlier implementation.

**Schema drift, confirmed:** migration 1 declares `check_in_time`/`check_out_time` as `timestamptz`; migration 15's own comment states the **live** columns are actually plain `timestamp` (no timezone) and that this drift was deliberately left unresolved ("does not change the type — it only rewrites the values"). The app writes/reads these as **IST wall-clock strings with no timezone designator** (`toLocalTimestamp()`/`parseTimestamp()` in `lib/attendance.ts`) — this only works correctly because the column type and the app's read/write code agree with each other, not because they match migration 1's original intent.

**Auto-clock-out cron** (`app/api/cron/auto-clock-out/route.ts`):
- Protected by a `CRON_SECRET` bearer-token check — **but only if the env var is set**; if `process.env.CRON_SECRET` is falsy, the check is skipped entirely and the endpoint is open to anyone who finds the URL. **Unverified** whether `CRON_SECRET` is actually set in the live Vercel project.
- Uses the **service-role** client (bypasses RLS), queries all rows with `status = 'Checked In'` regardless of date, and for each one still past its shift's cutoff, sets `status = 'Absent'`, stamps `check_out_time` at the exact cutoff instant, and recomputes `working_seconds`.
- **Idempotency:** re-running is safe for already-processed rows (they're no longer `status='Checked In'` after the first pass), but **not** safe against double-execution race conditions within the same run if the scheduler ever fires twice concurrently — not verified either way.
- **Trigger/schedule mechanism** (Vercel Cron, external cron service, or manual) — **not found in this repo**; no `vercel.json` cron config was located during this pass. **Requires investigation** — the schedule is not self-documenting from the codebase alone.

### 8.B Excel Import Pipelines — four independent importers, deliberately not unified

**Marketing Leads** (`lib/marketingExcelImport.ts`) — by far the most hardened of the four, built up over many iterations this project's history:
- Header-driven, not position-driven; scans up to 25 rows for a header row scoring ≥2 recognized fields among Name/Date/Company Name/Link aliases.
- Classifies every Date cell by its *original type* (Excel serial, JS `Date`, ISO string, ambiguous `a/b/yyyy` text) and only commits to a day/month reading for ambiguous text dates using workbook-wide evidence (self-evident sibling values, or chronological fit against the column's unambiguous dates) — never guesses blindly, reports `ambiguous-date`/`unreadable-date` rejects instead of silently corrupting a date.
- Detects and repairs the specific "Excel re-interpreted a d/m/y value as m/d/y" corruption pattern, but only when doing so provably restores chronological order for that run of rows.
- **Never** defaults a missing date to "today" — a row with no readable date is imported with `date = null`, not fabricated. This is a deliberate rule, explicitly contrasted below with Operations' importer, which does the opposite.
- Handles merged Date cells (resolves to the merge anchor) and "block inheritance" (a date is only ever inherited from an earlier row in the same unbroken run of non-blank rows, never across a blank-row gap).
- **Duplicate prevention (added this session, Option A — see §15):** before inserting, fetches the importing employee's own existing `(candidate_name, date, company_name, link)` combinations (chunked `.range()` fetch, not a single unbounded query — deliberately avoids being silently truncated by PostgREST's row-return cap), and skips any parsed row whose normalized key already exists — both against the database and against earlier rows in the same file. This is **import-screen-level** protection only (`MarketingClient.tsx`'s `handleFileUpload`), **not** a database-level unique constraint — a deliberate, explicit tradeoff: the live table already contained ~8,687 pre-existing duplicate rows (by this same key) at the time this was built, and adding a real constraint would have required cleaning that up first, which was explicitly deferred as a separate decision.
- The picked duplicate key is **Company Name + Link + Candidate Name + Date together** — verified against real multi-employee data that "Company + Link alone" is too loose (the same candidate legitimately reapplies to the same job link on different dates, sometimes dozens of times) and would have wrongly blocked real work.

**Candidates** (`lib/candidatesExcelImport.ts`) — simpler, single-sheet only. Parses positionally (`header: 1`) specifically because the real sheet has two columns both literally labeled "Password" (one for Marketing email, one for LinkedIn) — object-keyed parsing would collapse them. Falls back to assuming column 0 is the Name column when the sheet's own header row leaves that column unlabeled (confirmed real-world pattern in the actual "Candidates Details" source sheet) — only when at least 2 other recognizable headers are found and column 0 isn't otherwise claimed.

**Interview & Screening** (`lib/interviewScreeningExcelImport.ts`) — accepts three shapes: (1) a workbook with sheets literally named "Interview"/"Screening" (round-trips with this app's own Export XL), (2) a single sheet laid out like the original Google Sheet source, with Interview and Screening as two side-by-side blocks located by their own `Date`+`Candidate` header pair (not assumed fixed columns — a stray leading column would otherwise silently shift every field), (3) a bare 6-column table with no headers, where the file can't say which section it is, so the caller is prompted to choose. Reads dates as **displayed text**, not underlying value — deliberately, since real exports show a mismatch between displayed and stored value for some cells, and the displayed text is the only record of what was actually meant.

**Operations/Sales** (`lib/operationsExcelImport.ts`) — lighter-weight, **different conventions than Marketing's, worth knowing the contrast**:
- **Does** default a blank date to "today" (`new Date().toISOString().split('T')[0]`) — the exact behavior Marketing's importer deliberately avoids, and carries the same device-clock/UTC-truncation risk class already identified and fixed elsewhere in this project (Generate Report, Attendance).
- **Does** have its own duplicate detection — by email match, or contact-number match, or (if neither present) exact candidate-name match against already-loaded data — conceptually similar to Marketing's but a different, narrower key, implemented independently (not shared code).

### 8.C Recruitment / ATS

**Not implemented.** No resume parsing, no ML/scoring model, no scaler/preprocessing, no score persistence or thresholding logic was found anywhere in `lib/`, `app/`, or `components/`. "Recruitment" in this codebase means the **Candidates** tracker (`candidates` table — name, contact, marketing/LinkedIn credentials, technology, visa status, assignment to a recruiter, status enum, notes) — a lead/assignment tracker, not an applicant-scoring system. If an ATS-scoring feature was discussed historically, it does not exist in the current repository.

### 8.D Payroll & Leave

**Payroll formula** (`generate_payroll()` SQL RPC, mirrored client-side in `lib/payroll.ts`'s `calculateSalaryBreakup()` for preview only — the RPC is authoritative):
```
basic              = gross * 0.5
hra                = gross * 0.2
special_allowance  = max(0, gross - basic - hra - travel_allowance)
total_earnings     = gross + other_allowances + incentives
per_day_salary     = gross / days_in_month
lop_deduction      = per_day_salary * lop_days
total_deductions   = lop_deduction + professional_tax(default 200) + income_tax + provident_fund + other_deductions
net_salary         = total_earnings - total_deductions
```
Writable **only** through the `generate_payroll()` SECURITY DEFINER RPC (Admin/HR-gated inside the function itself) — there is no direct INSERT/UPDATE RLS policy on `payrolls` at all, by design, so every payroll change is necessarily audit-logged (the RPC also inserts into `audit_logs`).

**Leave accrual** (`lib/leave.ts`):
- 2 leave days credited per full month of employment, counted from a **hardcoded baseline of August 2026** (`calculateMonthsEmployed()` — "leaves were reset to 0 in August 2026" per the code's own comment). This baseline is not configurable anywhere — it is a literal constant and will need code changes if/when it becomes stale.
- Plus/minus any approved `"Manual Credit"`/`"Manual Deduction"` leave-type rows.
- **LOP (Loss of Pay) calculation** (`lib/payroll.ts`'s `calculateEmployeeLopAndLeaves()`), used when generating payroll: builds a per-day map of approved leave from `leave_requests`, applies a **"Sandwich Rule"** (if Friday and the following Monday are both on leave, the intervening Saturday/Sunday are automatically counted as leave too), then compares leave taken in the target month against the accrued-but-unused balance carried in from prior months — only the excess becomes LOP days.
- **IST conversion in `calculateMonthsEmployed()`** uses `new Date(new Date().toLocaleString("en-US", {timeZone:"Asia/Kolkata"}))` — a round-trip through a locale string back into a `Date`, which is a less rigorous pattern than the `Intl.DateTimeFormat`-based approach used elsewhere in the project (e.g. the Generate Report IST fix). Not confirmed broken, but **inconsistent** with the project's own more-careful pattern elsewhere — worth normalizing if this file is touched again.

---

## 9. API Routes & Background Jobs

| Route | Method | Auth | Purpose | Notes |
|---|---|---|---|---|
| `/api/cron/auto-clock-out` | GET | `CRON_SECRET` bearer token (**skipped if unset** — see §8.A) | Force-closes any attendance row still `'Checked In'` past its shift's cutoff | Service-role client; trigger/schedule mechanism not found in-repo |
| `/api/send-leave-email` | POST | **None found** — no auth check in the route handler | Sends a leave-approval/rejection email via `nodemailer` | **Confirmed, previously-identified, deliberately-unfixed issue**: no authentication on this endpoint, and an empty/hardcoded SMTP password was noted in an earlier audit pass of this project. The project owner explicitly said **"don't fix that send leave email now"** — do not touch this file without that instruction being revisited. |

**Server Actions** (not HTTP routes, but equivalent "callable from anywhere with a session" surface — see §13 for why that matters):
- `app/actions/employees.ts` — `createEmployeeAction`, `updateEmployeeAction` (both call `assertCallerIsAdminOrHR()` first, using the **cookie-based** session client, before touching the service-role client — this is the **correct** pattern, a good reference example). `deleteEmployeeAction` delegates straight to the `delete_employee()` RPC, which re-checks Admin/HR itself server-side — also correct.
- `app/actions/marketing.ts` — `submitMarketingDailyReport`, `getMarketingDailyReports`, `updateMarketingDailyReport` (**dead code** — imported in two places, never actually called from either), `deleteMarketingDailyReport`, `getInterviewScreeningBreakdown`, `getIstYesterday`. **None of these check who is calling** — all use the service-role key unconditionally. Confirmed finding, not fixed (see §15).
- `app/actions/payroll.ts` — `updatePayrollExtraFields`, `getEmployeeBankName`, `getEmployeeProfileFields`. Same pattern: service-role key, **zero caller authorization check**. `getEmployeeBankName` in particular bypasses `employee_private`'s RLS (which normally restricts bank details to self/Admin/HR) for anyone who knows a UID. **Newly confirmed this pass, not previously flagged, not fixed.**

---

## 10. Database Schema (verified from migrations 1, 9, 12, 13, 14, 17, plus live schema queries this session)

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `full_name`, `email`, `role`, `status`, `job_role`, `employee_id`, `designation`, `department`, `phone`, `timezone`, `notifications_*` | One row per Auth user, created by the `handle_new_user()` trigger. Privileged fields (`role`, `status`, `employee_id`, `job_role`, `designation`, `department`) are write-protected by the `protect_profile_fields()` trigger — only `service_role` or Admin/HR can change them, even though `profiles_update` RLS would otherwise let a user update their own row. |
| `employee_private` | `id` (FK to `profiles`), `aadhar`, `pan`, `bank_account_name`, `bank_details`, `bank_name` | Split out of `profiles` in migration 14 specifically because `profiles_select` is `using(true)` — these four/five fields would otherwise have been world-readable the moment HR filled them in. Confirmed as a previously-remediated instance of the exact vulnerability class still open elsewhere (see §12). |
| `attendance` | `user_id`, `date`, `check_in_time`, `check_out_time` (both plain `timestamp`, IST wall-clock — see §8.A), `status`, `working_seconds`, `is_late`, `is_half_day`, `is_edited` | `unique(user_id, date)`. **No `created_at`/`updated_at` column** — no server-stamped reference time exists anywhere on this table. |
| `leave_requests` | `user_id`, `leave_type`, `start_date`, `end_date`, `days`, `reason`, `status`, `applied_on` | |
| `salary_structures` | `user_id` (PK), `gross_salary`, `travel_allowance`, `other_deductions`, `other_allowances` | One row per employee. |
| `payrolls` | `user_id`, `month`, `year`, full earnings/deductions breakdown (see §8.D) | `unique(user_id, year, month)`. Write-only via `generate_payroll()` RPC. |
| `announcements` | `title`, `body`, `author`, `pinned`, `archived` | |
| `documents` | `name`, `type`, `size`, `status`, `scope` (`'personal'|'company'`), `uploaded_by`, `storage_path` | Metadata only — actual files in the `documents` Storage bucket. |
| `notifications` | `user_id`, `message`, `type`, `read` | |
| `audit_logs` | `actor_uid`, `action`, `target`, `details` | Write-only via `log_audit()`/`generate_payroll()`/`delete_employee()` RPCs — no direct INSERT policy for `authenticated` at all. |
| `sales` | `candidate_name`, `date`, `contact_number`, `email`, `visa_status`, `job_role`, `experience`, `location`, `internal_name`, `linkedin_url`, `feedback`, `status`, `created_by` | Feeds Operations/Departments-Sales UI. |
| `marketing` | `candidate_name`, `date`, `company_name`, `link`, `created_by`, `created_by_name` | See §8.B for import/dedup logic. |
| `interview_screening_entries` | `section` (`'interview'|'screening'`), `entry_date` (free text, no year — see `lib/dateSort.ts`), `candidate`, `client`, `stage`, `recruiter`, `remarks`, `created_by` | Also has derived columns `entry_date_sort`/`entry_date_value` added by a later migration (session-referenced but the exact migration file for these was not re-opened this pass — **confirm against migration 19 if touching date-sort logic on this table**). |
| `interview_screening_remarks` | `row_sig` (PK, content signature `date\|candidate\|client`), `section`, `remark` | Overlay for rows that live only in the original read-only Google Sheet, not in `interview_screening_entries`. |
| `candidates` | `full_name`, `phone`, `marketing_email`/`marketing_password`, `linkedin_email`/`linkedin_password`, `technology`, `visa_status`, `status`, `notes`, `assigned_to`, `created_by` | Passwords stored **as plain text, deliberately** — these are shared account credentials the team manages on the candidate's behalf, not login secrets; comment in migration 13 explicitly documents this and notes they're exposed only via the (correctly scoped) `candidates_select` policy. |
| `marketing_daily_reports` | `user_id`, `user_name`, `report_date`, `no_of_candidates`, `applications`, `rtr_submissions`, `rtr_names`, `screenings`, `interviews`, `candidate_breakdown` (jsonb), `created_at` | **⚠️ No `CREATE TABLE` for this table exists in any tracked migration file** — confirmed via grep across all 24 migrations. It was created directly against the live database outside version control at some point in this project's history. Its live schema (confirmed via OpenAPI introspection this session) has RLS **enabled** with real policies (an anon-key insert was tested and correctly rejected with a `42501` RLS violation) — but the exact policy definitions were not re-extracted this pass, and since the table isn't in any migration file, **a fresh clone of this repo + a clean migration run would NOT recreate this table**. This is a real gap in the project's infrastructure-as-code coverage. |
| `salary_structures`, `payrolls` | — | See §8.D. |

**sales/marketing `created_by` legacy quirk:** `MarketingClient.tsx`'s ownership filter (`buildBaseQuery`) replicates an old client-side fallback: some historically-Excel-imported rows have `created_by` pointing at whichever admin account performed the import, not the actual rep — so the filter also matches on `created_by_name ilike` / `candidate_name ilike` against the viewer's own name, specifically so those legacy rows still show up for the right person. A migration (`00000000000008_backfill_created_by.sql`) partially addressed this with a one-time backfill (only for unambiguous single-name matches), but the UI-level fallback was kept rather than removed, implying the backfill didn't catch every case.

---

## 11. Row-Level Security — Full Verified State

**Legend:** 🟢 correctly scoped and verified · 🟡 intentionally open (directory-style data, judged low-risk) · 🔴 confirmed gap, not fixed · ✅ fixed this session

| Table | SELECT policy (current) | Assessment |
|---|---|---|
| `profiles` | `using(true)` — any authenticated user, all rows | 🟡 Intentional — names/roles/departments are directory data the app legitimately shows everyone (assignee dropdowns, team widgets). Sensitive fields were split out (see `employee_private`) specifically because of this. |
| `employee_private` | `id = auth.uid() OR is_admin_or_hr()` | 🟢 |
| `attendance` | `user_id = auth.uid() OR is_admin_or_hr()` | ✅ **Fixed this session** (migration `00000000000023`). Was `using(true)` — any authenticated employee, any role, any department, could read every other employee's check-in/out times and status via direct API calls (confirmed via DevTools by the project owner, reproduced and root-caused). Explicit project-owner decision: Team-Lead is **not** exempted — Team-Lead is limited to their own attendance only, same as a regular employee, even though this means the employee-profile-page attendance view will show empty when a Team-Lead views a team member (accepted tradeoff, not a bug). |
| `leave_requests` | `user_id = auth.uid() OR is_admin_or_hr()` | ✅ **Fixed this session**, same migration, same original `using(true)` problem. |
| `salary_structures` | `user_id = auth.uid() OR is_admin_or_hr()` | 🟢 |
| `payrolls` | `user_id = auth.uid() OR is_admin_or_hr()` | 🟢 (writes fully RPC-gated, see §8.D) |
| `announcements` | `using(true)` | 🟡 Intentional — company-wide broadcast content. |
| `documents` (table) | `using(true)` | 🔴 **Confirmed gap, not fixed.** `lib/documents.ts`'s `listenToDocuments()` fetches `select("*")` unfiltered and only restricts which rows are *kept* client-side (`scope==='company' || uploadedBy===userId` for non-admins) — meaning every authenticated user's browser receives every other employee's "personal"-scope document **metadata** (filename, uploader, status, and critically `storage_path`) over the network before any filtering happens, regardless of role. |
| `documents` (Storage bucket `documents`) | `bucket_id = 'documents'`, any authenticated user, **no path/ownership check** | 🔴 **Confirmed gap, not fixed — and compounds the table-level one.** Because the `documents` table leaks every row's `storage_path` to every authenticated client (see above), and the bucket itself will hand out a signed URL for *any* path to *any* authenticated caller, a non-admin employee who inspects their own network traffic (same technique already demonstrated against `attendance`) can obtain another employee's `storage_path` and then call `createSignedUrl()` themselves for it — getting a working download link to someone else's personal document (ID proof, bank letter, etc.). This was reasoned through and cross-checked against both the table and bucket policies this pass; **not independently reproduced live**, but the code path is concrete and traceable. |
| `notifications` | `user_id = auth.uid() OR is_admin_or_hr()` | 🟢 (explicitly tightened vs. the old Firestore rule per migration 2's own comment) |
| `audit_logs` | `is_admin()` only | 🟢 |
| `sales` | `created_by = auth.uid() OR is_admin_or_hr() OR current_role_name()='SALES'` | 🟢 |
| `marketing` | `created_by = auth.uid() OR is_admin_or_hr() OR current_role_name()='MARKETING'` | 🟢 at the RLS layer. Client-side (`MarketingClient.tsx`) additionally exempts Marketing Team-Lead from its own extra UI-level ownership filter (fixed earlier this project to match RLS intent) — HR is deliberately **not** exempted there, by explicit project-owner decision (RLS technically permits it; the UI intentionally doesn't use that permission). |
| `interview_screening_entries` | `using(true)` for SELECT (shared team resource — everyone who can reach the Data tab can read it); INSERT/UPDATE/DELETE scoped to creator or Admin/Marketing-Team-Lead | 🟢 as currently intended — but this table's visibility rule **drifted at least once in this project's history** (was briefly owner-only due to an un-tracked live change, caught by the project owner inspecting the policy directly in the Supabase dashboard, and restored via migration 20 to the intended Marketing+Team-Lead+Admin scope, explicitly excluding HR). Worth re-verifying live if anything here looks wrong again — this table has a track record of the live policy drifting from what the migration files say. |
| `interview_screening_remarks` | `using(true)` for SELECT/INSERT/UPDATE; delete Admin/HR only | 🟡 Intentional — shared team resource. |
| `candidates` | `assigned_to = auth.uid() OR is_admin_or_hr() OR is_marketing_team_lead()` | 🟢 |
| `marketing_daily_reports` | RLS **enabled**, policies **not re-extracted this pass** (confirmed via a rejected anon insert, not via reading the policy SQL — table has no tracked migration, see §10) | 🟡 Unverified exact policy text; the real exposure for this table is the **unprotected Server Actions** that bypass RLS entirely (see §9/§13), not the RLS policy itself. |

**Storage policies** (`storage.objects`, bucket `documents`, from migration 3): bucket is private (`public=false`); INSERT/UPDATE/DELETE all correctly check `(storage.foldername(name))[2] = auth.uid()::text OR is_admin_or_hr()` (2nd path segment = uploader's UID, per the `{scope}/{uploader_uid}/{timestamp}_{filename}` convention) — only SELECT is unrestricted, per the gap noted above.

---

## 12. Authentication & Session Architecture

- **Supabase Auth**, email/password. `components/providers/AuthProvider.tsx` subscribes to `onAuthStateChange`, loads the matching `profiles` row, and keeps it live-synced via a per-user Realtime channel (so an Admin changing someone's role reflects immediately in their open tab).
- **`lib/supabase/middleware.ts`'s `updateSession()` is dead code** — confirmed by a direct filesystem search: there is **no root-level `middleware.ts`** anywhere in the project (only this helper function, and Next.js's own internal files under `node_modules`). Next.js never invokes middleware unless a `middleware.ts` exists at the project root (or `src/`) and is exported as the convention expects. This means: (a) there is no server-side session-cookie refresh happening on the edge/server for every request — the Supabase JS SDK's own client-side auto-refresh is the only thing keeping sessions alive — and (b) there is **no server-level route protection at all**; every bit of "you can't see this page" enforcement happens client-side, in the browser, after the page's JS has already loaded.
- **Practical consequence, consistent with everything found in §9/§13:** route-level and page-level gating (`ProtectedRoute`, in-page redirects) only stop a user from *navigating* to a screen through the normal UI. They do nothing to stop a direct call to a Server Action or a direct Supabase REST request — RLS is the only real backstop for table access, and for the Server Actions that bypass RLS via the service-role key, **nothing** is the backstop, which is the core of every confirmed finding in §9.
- **Employee account creation** goes through `createEmployeeAction` (§9) using the Auth Admin API — the only way new accounts are created; there's no public signup flow (`handle_new_user()`'s trigger comment explicitly notes client-driven signup, if ever enabled, always defaults to role `'Employee'` regardless of any metadata the signing-up client tries to supply).

---

## 13. Frontend Architecture Notes

- **No shared data-fetching layer.** Every list component (Marketing, Candidates, Interview&Screening, Attendance dashboards, Leave dashboards, etc.) hand-rolls its own `useState` + `useEffect` + Supabase query + Realtime subscription + cleanup. This is consistent across the codebase (a deliberate style choice, not an oversight), but means any future shared concern (e.g. a global loading indicator, request deduplication) would need to be threaded through every single component individually.
- **Search patterns**: Marketing, Candidates, and Interview & Screening each independently define their own `escapeLike()`/`buildSearchPattern()` helpers (not shared) to implement server-side, separator-insensitive `ILIKE` search. **Confirmed subtle bug, low severity, not fixed:** Interview & Screening's version calls `buildSearchPattern(escapeLike(search))` — double-processing the string — while Marketing's correct version calls `buildSearchPattern(search)` directly (the function already does its own escaping internally). The double-processing can produce a technically-malformed ILIKE pattern for search terms containing `_`, `\`, or `%`, though in practice table search terms rarely contain those characters so it's unlikely to have been noticed. Deliberately not touched, since the instruction at the time was "do not modify Interview & Screening."
- **Multiple independent `profiles` fetches observed** (via browser DevTools, by the project owner) — not root-caused in detail, but consistent with the "no shared data-fetching layer" pattern above: several components (e.g. `CandidatesClient.tsx`'s `loadEmployees()`, `my-team/page.tsx`'s `fetchTeam()`, `AuthProvider`'s own profile fetch) each independently query `profiles` rather than sharing one cached result. Flagged as a performance/efficiency item, not a correctness or security issue.
- **Vercel Hobby-plan risk** (discussed with the project owner, not a code issue): this ERP runs real company data under what was, at the time of discussion, a Vercel Hobby (free) plan — both a hard-limit risk (Hobby has no pay-as-you-go overage; exceeding a quota blocks traffic until the next cycle) and a Terms-of-Service risk (Hobby is for non-commercial projects). Recommendation given was to move to Vercel Pro; **not verified whether this has happened**.

---

## 14. Deployment & Environment

- **Hosting:** Vercel (confirmed via `erp-system-production.vercel.app` observed in the project's own Vercel dashboard during this project's history; also a second, apparently-unrelated `naammaann_port` project on the same Vercel account).
- **Repo:** GitHub, `naammaann31/ERP-System-Production`, branch `main`.
- No CI/CD workflow files (`.github/workflows/`) found in this pass — **requires investigation** if deployment automation is assumed to exist.
- No `vercel.json` found — so any cron schedule for `/api/cron/auto-clock-out` is either configured directly in the Vercel dashboard (not visible from the repo) or via an external scheduler hitting the URL with the `CRON_SECRET` header. **Unverified.**

---

## 15. Known Issues, Historical Findings & Their Current Status

| Issue | Status | Evidence | Impact | Safe next step |
|---|---|---|---|---|
| `attendance_select` / `leave_requests_select` open to all authenticated users | **Fixed** this session | Migration `00000000000023_restrict_attendance_leave_select.sql` | Was: any employee could read everyone's attendance/leave via direct API calls, regardless of role | Verify live, per the user's own DevTools technique, that a non-privileged account now gets only its own rows |
| `documents` table SELECT (`using(true)`) + Storage bucket SELECT (no path check) | **Confirmed, not fixed** | §11/§12 above, `lib/documents.ts`, migration 2 & 3 | Document metadata for every employee's "personal" files is visible to everyone; chained with the bucket policy, another employee's actual file is plausibly downloadable by a technically-inclined user | Needs the same treatment as attendance: scope table SELECT to `uploaded_by = auth.uid() OR scope='company' OR is_admin_or_hr()`, and the bucket policy to check the path's UID segment for `'personal'` paths |
| Unprotected service-role Server Actions (`app/actions/marketing.ts` Daily Report functions, `app/actions/payroll.ts` entirely) | **Confirmed, not fixed** | §9 above | Any authenticated user — any role — can call these directly (bypassing the UI) to read/write Daily Reports for any employee, or read any employee's bank name/profile fields | Add a caller-authorization check at the top of each action, mirroring `app/actions/employees.ts`'s `assertCallerIsAdminOrHR()` pattern (already proven correct, already in this codebase) |
| `marketing_daily_reports` has no tracked `CREATE TABLE` migration | **Confirmed, not fixed** | §10 above — grep across all 24 migration files found zero `create table .* marketing_daily_reports` | A fresh environment built from migrations alone would be missing this table entirely; its RLS policies also aren't captured in version control | Write a migration that creates the table (matching the live schema already confirmed via OpenAPI) and recreates its current RLS policies, without altering live data |
| Generate Report date mismatch (client-clock-dependent, decoupled from the numbers it reports) | **Fixed** this session | `GenerateReportModal.tsx`, `getIstYesterday()` in `app/actions/marketing.ts` | Was: report date silently guessed from "now minus one day" on the submitter's own device clock, independent of what date range the displayed numbers actually covered — could mislabel a late submission or misreport totals if no date range was selected | — |
| Marketing Leads null-date sort order | **Fixed** earlier this project | `nullsFirst: false` added to `MarketingClient.tsx`'s `.order("date", ...)` | Was: imported rows with no date sorted to the top above today's genuinely-dated entries | — |
| Marketing Team-Lead (Asrar Patni) saw an empty Data tab | **Fixed** earlier this project | `isMarketingTeamLead()` wired into `MarketingClient.tsx`'s ownership filter | RLS already permitted full visibility; the client-side query was additionally, wrongly, restricting to "own rows only" for anyone who wasn't literally `role==='Admin'` | — |
| Marketing import duplicate prevention | **Fixed** this session (Option A — see §8.B) | `MarketingClient.tsx`'s `handleFileUpload` | Was: zero duplicate detection; a panicked re-import of the same file multiplied the data (confirmed real incident: 150 rows → 450 rows across 3 re-imports) | Deliberately left without a database-level constraint — 8,687 pre-existing live duplicates would block adding one; that cleanup is a separate, un-taken decision |
| Interview & Screening visibility RLS drift | **Fixed**, but **pattern risk noted** | Migration 20 | Live policy had drifted to owner-only, diverging from migration files, caught only by manually inspecting the live Supabase policy editor | If anything about this table's visibility looks wrong again, check the **live** policy directly — this table has drifted from its migration history at least once before |
| Attendance discrepancy for a specific employee (Apoorv Giri, Oct 2026) | **Investigated, root cause not provable** | Raw `attendance` rows pulled directly, showed a multi-day progressive drift pattern (check-in time drifting earlier day over day) consistent with an unsynced device clock | One specific employee's logged hours may be understated for several days around Oct 1–2, 2026 | The table has no server-stamped timestamp to compare against (see §8.A) — if this needs to be revisited, that limitation needs solving first, independent of this one incident |
| `app/api/send-leave-email/route.ts` has no authentication | **Confirmed, explicitly deliberately not fixed** | Route handler, no session/auth check found | Anyone who finds the URL could trigger arbitrary leave-status emails | Project owner explicitly said not to fix this now — do not touch without revisiting that instruction |
| `getLocalDateString()` vs. migration 16's stated intent | **Discrepancy noted, not resolved** | §8.A above | Could mean night-shift attendance is being filed under a different calendar date than the migration's own comment claims is the current behavior | Needs a side-by-side read of migration 16 and the current function to determine which one is actually stale |
| Export XL "Max Rows" PostgREST cap | **Raised, explicitly deferred by the project owner** ("keep that thing aside for right now") | `MarketingClient.tsx`'s `handleExport` has no `.range()`, relying entirely on whatever the Supabase project's dashboard-configured row cap is | At very high row counts (the project is trending toward ~160,000 Marketing rows across 8 employees), Export XL could silently return a truncated file with no error | Verify the live project's PostgREST "Max Rows" setting in the Supabase dashboard before relying on Export XL at that scale |
| Vercel Hobby-plan limits/ToS | **Raised, not resolved** | §13 above | Possible hard outage at a quota ceiling (no graceful degradation on Hobby), plus a standing ToS risk for commercial use | Move to Vercel Pro — a billing/business decision, not a code change |
| Interview & Screening search double-escaping | **Confirmed, low severity, deliberately not fixed** | §13 above | Search terms containing `_`, `\`, or `%` could produce a malformed ILIKE pattern | Align with Marketing's correct `buildSearchPattern(search)` call (no `escapeLike()` wrapper) if this file is touched again |

---

## 16. Non-Negotiable Change Constraints (established project convention, not new rules)

These reflect how work on this project has actually been done, verified through this project's own history, not aspirational guidelines:

- Every non-trivial change this project's history shows was **analyzed and explained first**, with the actual code/data traced (not assumed), before anything was implemented — and frequently the user asked for the fix to be re-explained in plain language with a concrete scenario before giving the go-ahead.
- Changes are scoped **narrowly**. When fixing one table/module's RLS or logic, other modules' files are not touched "while we're at it" — e.g. the duplicate-prevention work explicitly avoided touching Marketing's Interview & Screening or Candidates code; the attendance RLS fix was scoped to exactly two tables, not applied broadly to every `using(true)` policy found along the way (several others — `documents`, `profiles`, `announcements` — were found and documented but explicitly left alone).
- **Verify against the live database, not just migration files**, whenever a claim about current behavior matters — this project has concrete, repeated history of the live policy/schema drifting from what the migration files say (Interview & Screening visibility drift, the `timestamptz`-vs-`timestamp` schema drift, `marketing_daily_reports` having no migration at all). A migration file describes intent; only a live query confirms current reality.
- Destructive or data-affecting changes (deleting duplicate rows, adding a hard uniqueness constraint, cleaning up historical data) are **never** taken unilaterally — they are explicitly surfaced as a separate decision with the exact scope/row-counts shown first.
- Database migrations in this project are applied **manually by the project owner** — writing the `.sql` file is this agent's job; running it against the live project is not something this agent has tooling to do (no direct Postgres connection, no Supabase CLI session observed in this environment).

---

## 17. Areas Explicitly Not Audited / Requiring Further Investigation

Documented honestly rather than silently omitted, per this task's own instructions:

- `app/dashboard/daily-reports/sales/page.tsx` and the Sales Daily Report flow generally — route confirmed to exist, internals not traced this pass.
- `components/dashboard/payroll/*` and `components/dashboard/leave/*` UI components — business logic underneath them (`lib/payroll.ts`, `lib/leave.ts`) was read in full, but the components' own rendering/interaction logic was not individually traced.
- `components/dashboard/operations/*`, `components/dashboard/departments/SalesDataSection.tsx` — UI not traced beyond confirming their existence and the `sales` table/`salesMarketingMap.ts` they depend on.
- `app/dashboard/employees/page.tsx`, `app/dashboard/employees/[uid]/page.tsx` — read enough to confirm the attendance-history call pattern (§7/§12 Team-Lead exemption reasoning); the rest of these pages' functionality (edit forms, document section, etc.) not individually traced.
- `generate_emails.py`, `generate_replies.py`, and the `pmt_progress_reports/` directory — confirmed to exist at the repo root, appear to be standalone Python scripts unrelated to the Next.js app, **not traced** — unverified whether these are still in active use or leftover from a one-off task.
- Exact SMTP environment variable names and whether `CRON_SECRET` is actually set in the live Vercel project — both referenced in code, neither verified live.
- The precise RLS policy text currently live on `marketing_daily_reports` (existence of RLS and its basic enforcement was verified via a rejected anon-key insert; the exact `USING`/`WITH CHECK` clauses were not re-extracted).
- `interview_screening_entries`'s `entry_date_sort`/`entry_date_value` derived columns — referenced from this project's history as added by a later migration, but that specific migration file was not re-opened during this pass to confirm the exact trigger/function definitions.
- Whether a CI/CD pipeline or Vercel cron configuration exists outside this repository (dashboard-only configuration would not be visible here).
- `xlsx-js-style` and `docx` package usage — listed as dependencies, specific call sites not located this pass.

---

## 18. Documentation Maintenance

This file should be treated as a living document. When a future session makes a change covered by a section above (especially §11 RLS state, §15 Known Issues, or §7 Role Matrix), update the relevant row/entry rather than letting this file drift the same way the SQL migrations have been observed to drift from the live database. Prefer updating a table row over appending a new "latest changes" section at the bottom — this file is organized by topic, not chronologically.
