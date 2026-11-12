# Backend integration (Supabase)

Branch `feature/backend-integration`. Start with [BACKEND_ARCHITECTURE_ASSESSMENT.md](BACKEND_ARCHITECTURE_ASSESSMENT.md) for the "why"; this file is the "how".

> **Update 2026-11-12:** commuters now sign in with Supabase accounts and the admin website is connected. Read [ADMIN_SUPABASE_INTEGRATION.md](ADMIN_SUPABASE_INTEGRATION.md) for the current setup (email auth instead of anonymous guests, admin bootstrap, new migration).

**Status:** schema, RLS, RPCs, seed, typed frontend adapters and tests are done and verified locally. **No hosted Supabase project has been created or connected yet** — that needs a team account (steps below). Demo mode remains the default and behaves exactly as before.

## Architecture in one picture

```
Supabase Postgres (RLS)          Browser
──────────────────────           ───────────────────────────────────────────────────────────
transport_* / fare_* tables ──► CommuterDataGate ─ loadRemoteCatalog ─ buildRemoteCatalog ──► services/catalog.ts
get_current_fare_rules()                         (validates; error+retry, never demo fallback)   (live ES bindings)
                                                                                                       │
                                  existing lib/routeEngine.ts, advisoryImpact, locations, pages ◄─────┘  (unchanged logic)
get_queue_estimates() ◄─ Realtime signal ─ useLiveQueues ──► reports ──► route engine / QueuesPage
submit_queue_report()   ◄─────────────── CommuterApp.submitReport (anonymous guest session)
road_advisories (+impacts) ◄─ Realtime ─ createRemoteRoadWatchProvider ──► existing useRoadWatch (validates)
support_* RPCs + tables  ◄─ Realtime ─ createRemoteSupportService ──► existing useSupportCenter / SupportCenter
```

Data source = Supabase. Business logic = the **existing** route engine and advisory/queue utilities (not re-implemented server-side). Presentation = the existing React screens.

## Demo vs live mode

| `VITE_SAKAYWISE_DATA_MODE` | Behaviour |
| --- | --- |
| `demo` (default, or unset) | Bundled fixtures, local queue reports, local support history. No network requests; the Supabase SDK is not even downloaded (dynamic import). |
| `live` | Loads one validated network/fare snapshot from Supabase before the app mounts. Queue reports, advisories and support go to Supabase. Missing/invalid config or a failed load shows an error screen with retry. Demo fixtures are never substituted. A secret/service-role key in config is refused. |

Labels stay truthful in both modes: the header badge reads *Demo data · SakayWise database* while the database holds illustrative seed data, queue cards say *Community reports · N confidence · Not verified*, and support shows *Sent to support* only after the server accepted the insert and *Seen by support* only when an admin actually opened it.

## Setup

### 1. Create the Supabase project (team owner, once)

1. Create a project at supabase.com (region: Singapore is closest to PH).
2. **Authentication → Sign In / Providers → enable "Allow anonymous sign-ins".** Guests need it to submit queue reports and support messages. Consider enabling CAPTCHA (Auth → Attack Protection) before public launch.
3. Keep **Realtime** enabled (default).
4. Never share the database password or `sb_secret_…`/`service_role` key in chat, code or `VITE_` variables.

### 2. Apply migrations

```sh
npm ci
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push              # applies supabase/migrations
```

### 3. (Demo/staging project only) load the illustrative seed

SQL editor → paste `supabase/seed.sql` → Run. Or `psql "<connection string>" -f supabase/seed.sql`. Do not load it into a project meant for real commuters.

### 4. Bootstrap the first administrator

Create the user (Dashboard → Authentication → Add user, with email + password), then in the SQL editor (runs as `postgres`, bypassing RLS):

```sql
insert into public.admin_role_assignments (user_id, role)
select id, 'super_admin' from auth.users where email = 'owner@example.com';
```

From then on only a `super_admin` can grant/revoke roles (enforced by RLS); anonymous users can never hold a role; the last active super admin cannot be removed.

### 5. Run the app in live mode

```sh
cp .env.example .env.local        # git-ignored
# set VITE_SAKAYWISE_DATA_MODE=live, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Switch back with `VITE_SAKAYWISE_DATA_MODE=demo` (or delete `.env.local`) and restart Vite.

### Local Supabase (optional, needs Docker)

```sh
npx supabase start && npx supabase db reset   # migrations + seed; anonymous sign-ins on via config.toml
# then VITE_SUPABASE_URL=http://127.0.0.1:54321 and the local publishable/anon key printed by `supabase start`
```

## Frontend changes (for the frontend developer)

### New files

| File | Purpose |
| --- | --- |
| `services/runtimeConfig.ts`, `services/env.ts` | Parse/validate env; refuse privileged keys. |
| `services/catalog.ts` | Active catalog (demo fixtures or live snapshot) as ES live bindings. |
| `services/supabase/client.ts`, `session.ts` | Lazy SDK client; anonymous guest session created only on first submission. |
| `services/supabase/remoteCatalog.ts` | Pure row → model mapping and validation (unit-tested, no SDK). |
| `services/supabase/remoteServices.ts` | Catalog loader, QueueSense, RoadWatch provider, remote `SupportService`. |
| `components/CommuterDataGate.tsx` | Loading / error / retry gate for live mode. |
| `hooks/useLiveQueues.ts` | Server queue estimates + Realtime + expiry refresh + abort. |

### Shared-type changes (all additive, optional fields)

- `Place.source` gains `'remote'`; new optional `Place.provenance`.
- `QueueReport` gains optional `source: 'community-aggregate' | 'terminal-staff'`, `confidence`, `sampleCount`.
- `RoadWatchProvider` gains optional `subscribe(onChange)`.
- `SupportErrorCode` gains `'closed' | 'rate-limited' | 'unavailable' | 'network'`.

### Behaviour changes in existing modules (minimal)

- Fixture imports in `routeEngine`, `advisoryImpact`, `roadwatchService`, `fares`, `locations`, `roadwatchPersonalization`, `RoutesPage`, `AlertsPage`, `QueuesPage`, `Sheets`, `RoadWatchDetails` now come from `services/catalog` (same data in demo mode).
- `isSelectedLocation` validates non-manual places against the active catalog (same result in demo mode).
- `latestQueueReport` also honours server aggregates (`source`), still never untagged baseline cards.
- `useSupportCenter` exposes `mode`; starts a new conversation if the selected one is closed; in remote mode marks support replies read when shown.
- `useRoadWatch` reloads when the provider signals a change.
- Copy changes are mode-dependent only (demo copy is unchanged). 51 new strings with Filipino translations.
- `CommuterApp`: default journey = first popular pair of the active catalog (same as before in demo).

### Not changed

Route engine algorithm, ranking, fares maths, advisory impact rules, settings/i18n system, layout/styles (one small CSS block for the gate), local storage keys. Local demo reports/support history are never uploaded.

## Service contracts the app uses

| Call | Kind | Who |
| --- | --- | --- |
| `transport_places/stops/services/segments`, `queue_terminals`, `popular_journeys` | `select` (active rows) | anyone |
| `get_current_fare_rules(p_at)` | RPC | anyone |
| `get_queue_estimates(p_at)` | RPC (aggregates only) | anyone |
| `submit_queue_report(p_terminal_id, p_queue_level, p_request_id, p_details?, p_segment_id?, p_estimated_wait_minutes?, p_report_source?)` | RPC | signed-in (incl. anonymous) |
| `road_advisories` + embedded `road_advisory_impacts` | `select` (published) | anyone |
| `support_create_conversation / support_update_conversation / support_send_message / support_mark_read` | RPC | conversation owner (or support staff) |
| `support_conversations`, `support_messages` | `select` (RLS: own / support staff) | signed-in |
| Realtime `postgres_changes` on `queue_terminal_signals`, `road_advisories`, `support_messages`, `support_conversations` | subscription | RLS-filtered |

Server error messages are stable codes (`rate_limited`, `duplicate_report`, `conversation_closed`, …); the client maps them to translated text. Rate-limit errors return HTTP 429.

Admin-facing contracts: [ADMIN_DATA_CONTRACTS.md](ADMIN_DATA_CONTRACTS.md). Security and privacy: [BACKEND_SECURITY_PRIVACY.md](BACKEND_SECURITY_PRIVACY.md). Migrations and rollback: [../supabase/README.md](../supabase/README.md).

## Testing

```sh
npm run typecheck
npm test            # 82 frontend tests (72 existing + 10 integration-layer tests)
npm run test:db     # 45 database tests on PGlite: schema, constraints, RLS, RPCs, DB → route-engine contract
npm run seed:check  # seed.sql matches the frontend fixtures
npm run build
```

`test:db` covers: migrations apply; seed re-runnable and fully labelled; FK/constraint rejections; public cannot modify fares or publish official advisories; unauthorised users cannot read admin data; no privilege escalation; anonymous users cannot be admins; guests cannot read other conversations or impersonate admins; rate limits; queue validation, idempotency, one-vote-per-reporter aggregation, expiry and moderation; fare rule selection (verified beats sample, no category mixing, effective dates); advisory impact mappings; and that the seeded database produces **identical** recommendations to demo mode for all 96 popular-journey × passenger × priority combinations.

Also verified manually during development (not in CI): migrations + seed on PostgreSQL 16; the live-mode production build in Chromium against PostgREST 12 with an anonymous-auth stub — routes from the database, queue report submit + duplicate 429 message, support message → admin reply (via RPC as `support_staff`) → shown and marked read, advisories feed; demo build contacted no host other than its own origin.

## Known limitations

- No hosted project exists yet; anonymous sign-ins must be enabled there.
- Realtime was not exercised end-to-end (no Realtime server locally). The code refetches on every (re)subscription and after each send, so a missed event is recovered on reconnect/reopen.
- The live catalog is loaded once per page load; transport/fare edits by admins appear after reload.
- Screen copy still says "demo/sample" for routes and fares. When verified data replaces the seed, the frontend must make those labels provenance-aware (the provenance is already available via `getActiveCatalog().provenance` and fare `verification_status`). FareGuard must keep saying "not proof of overcharging" until verified tariffs are loaded.
- Main bundle is 520 kB (baseline 484 kB), just over Vite's 500 kB advisory warning; the SDK itself is code-split.
- No geographic map / geometry (unchanged: none may be fabricated).

## Remaining tasks

1. Team owner creates the Supabase project, enables anonymous sign-ins, runs `db push`, bootstraps the super admin.
2. Decide whether the shared project gets the demo seed or starts empty; agree retention periods and schedule `private.purge_expired_data()`.
3. Admin dashboard (`src/apps/admin/`) against the contracts in ADMIN_DATA_CONTRACTS.md.
4. Collect and verify official fare matrices; then provenance-aware labels in the commuter UI.
5. Optional: account sign-in for synced saved trips/preferences (tables and RLS already exist).
