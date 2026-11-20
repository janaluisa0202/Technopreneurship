# SakayWise integration inventory (admin ⇄ commuter ⇄ Supabase)

Assessment of `feature/backend-integration` at `d61f0d6` (backend branch merged with the admin website from `main`), written before this integration work. The "After" column is filled in from verified behaviour; see the bottom of this file for how each status was verified.

Status legend: **Live** = reads/writes Supabase in live mode, verified · **Partial** = connected with a documented gap · **Demo only** = still browser/local data in both modes · **N/A** = intentionally local (per-device convenience).

## Shared

| Feature | Before (source) | Gap found | After |
| --- | --- | --- | --- |
| Login / register / forgot password (`shared/auth`) | `localStorage` accounts, SHA-256 in browser, roles hard-coded in JS | Role decided by the browser; no server identity; admin site trusted a client flag | **Live**: Supabase Auth (email + password); role from `my_admin_roles()` (server); password-reset email + set-new-password screen |
| Session restore / sign-out | `sessionStorage`/`localStorage` token | Not a real session | **Live**: Supabase session (refreshing JWT), "keep me signed in" honoured, sign-out revokes |
| Admin site gate (`admin-main.tsx`) | client role check | Bypassable | **Live**: needs a non-anonymous Supabase session **and** an active role row; every query is still enforced by RLS |
| Shared support store (`shared/messaging`) | `localStorage` + `storage` event (same browser only) | Two isolated stores in live mode (commuter → Supabase, admin → localStorage) | Demo only (kept for demo mode); live mode uses Supabase tables on both sides |

## Commuter app

| Feature | Before | Gap | After |
| --- | --- | --- | --- |
| Routes / route engine / fares / Fare Matrix | Supabase snapshot (live) / fixtures (demo) | — | **Live** (unchanged) |
| QueueSense report + estimates | Supabase RPCs | Admin moderation never reached it; no spam state | **Live**; admin approve/reject/spam is the same row; spam + rejected excluded from estimates |
| RoadWatch / Para Alerts advisories | Supabase `road_advisories` | Admin incidents never reached it | **Live**; admin-posted incidents appear (labelled "SakayWise advisory") via Realtime + reload |
| Help & Support chat | Supabase (anonymous session) | Not tied to the signed-in account; admin could not see it | **Live**; conversations owned by the signed-in account; admin replies, status, read receipts round-trip |
| Support unread badge | demo store only (forced 0 in live) | — | **Live**: count of unread support replies, Realtime + polling |
| Announcements, promos, broadcast messages | not shown anywhere | Admin content never reached commuters | **Live**: new *Para Alerts → Updates* section (published announcements, active promos, all-user and matching route messages) |
| Account card in Settings / sign-out | demo account | — | **Live** account |
| Saved trips, addresses, alert/RoadWatch preferences, settings, watched trip | `localStorage` | Per-device by design | **N/A** (still per device; `commuter_saved_trips`/`commuter_preferences` tables exist for a future sync) |

## Admin dashboard

| Module | Before | Backend needed | After |
| --- | --- | --- | --- |
| Dashboard KPIs + recent lists | Computed from `localStorage` seed | Same calculations over live records | **Live** (same formulas; definitions below) |
| Promos | `localStorage` | New `promos` table + RLS | **Live**; active, in-date promos shown to commuters |
| Help Center | shared demo store | Admin read/unread, spam flag, staff names | **Live**: `support_*` tables + new `support_set_spam`, `support_mark_unread`; replies via `support_send_message` |
| Incidents / RoadWatch | `localStorage` | Map to `road_advisories` | **Live**: create/edit/resolve/delete advisories (`source_type = 'operator'`) |
| Direct Messages | one → demo thread; all/route recorded only | Delivery for each audience | **Live**: one → commuter's support thread (`admin_send_message`); all/route → `admin_messages` broadcast shown in commuter Updates |
| Queue Reports | `localStorage` seed | Moderation on `queue_reports` | **Live**: approve / reject / spam / undo on real reports; latest approved per terminal |
| Announcements | `localStorage` | New `announcements` table | **Live**: draft → published → archived; published shown to commuters |
| Users | demo account list | Server list of commuter accounts | **Live**: `profiles` + `admin_list_users()` (staff only) |
| Activity Log | `localStorage` | Server audit trail | **Live**: `admin_audit_log` (DB triggers + explicit events); readable by `admin`/`super_admin` |
| Settings → reset demo data | always shown | Must not exist in live | Demo only (hidden in live) |
| Theme | `localStorage` | per-device | **N/A** |

## KPI definitions (unchanged formulas, now over live records)

| KPI | Definition |
| --- | --- |
| Active promos | `status = active` and `start_date ≤ today ≤ end_date` (Asia/Manila date) |
| Open support messages | conversations with `status = open`, not flagged spam |
| Unread messages | non-spam conversations with at least one commuter message whose `read_at` is null (an admin has not opened it) |
| Active incidents | advisories whose stored status is `active` |
| Pending queue reports | reports with `moderation_status = unreviewed` **in the loaded window (last 7 days)** |

Data-definition change: in live mode an *unreviewed* community queue report still counts toward commuter estimates (as "not verified", low confidence) until a moderator rejects it or marks it spam; it expires after 30 minutes either way. Requiring approval first would make every live estimate at least as old as the review delay. The admin page copy says this.

## How each status was verified

- **Live** rows were exercised by the live end-to-end run (25 steps, Chromium against PostgreSQL 16 + PostgREST 12, with a Supabase-Auth-compatible stub and no Realtime). The database rules behind them are covered by `npm run test:db` (55 tests). Details: [ADMIN_SUPABASE_INTEGRATION.md](ADMIN_SUPABASE_INTEGRATION.md#verification).
- **Unverified** in this environment: the hosted Supabase project itself, Supabase Realtime delivery (polling fallback verified instead), and real confirmation/reset emails.
- **Partial**: none of the modules above are partial in function. The known gaps are bounded load windows (no "load more"), staff incidents being informational only, and route broadcasts matching only routes the commuter planned, watches or saved. These are listed under *Known limitations* in the integration guide.
