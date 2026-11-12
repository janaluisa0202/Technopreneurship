# SakayWise commuter frontend

SakayWise is a mobile-first Philippine commuter **academic prototype**, built with React, TypeScript and Vite. It compares explicitly mapped sample journeys, passenger-specific sample fares, local queue reports and simulated road advisories. Commuters can use it without an account.

**This is not live travel guidance.** The app runs in **demo mode** by default (bundled illustrative data, no network). An optional **live mode** connects to a Supabase backend (PostgreSQL + Auth + Realtime) for the transport network, fares, community queue reports, RoadWatch advisories and commuter-to-admin support messaging — see [docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md). In live mode the shared login uses Supabase Auth, and the **admin website** (`/admin.html`) manages the same records the commuter app uses: support, queue moderation, incidents, promos, announcements, broadcasts, users and the activity log. See [docs/ADMIN_SUPABASE_INTEGRATION.md](docs/ADMIN_SUPABASE_INTEGRATION.md). No official fare feed, live traffic/GPS, push notifications or geographic map is connected, and the provided seed data is illustrative.

## Install and run

Use Node.js 22.12+ (or Node 24 LTS) and npm. Commit and use the existing `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/`. Desktop displays the same app inside a centered phone frame; mobile fills the usable viewport. The app starts at `src/main.tsx`.

```sh
npm run typecheck
npm test
npm run test:db     # database migrations, RLS and RPC tests (PGlite, no Docker)
npm run seed:check  # supabase/seed.sql matches the frontend fixtures
npm run build
npm run preview
```

`npm test` compiles the TypeScript Node tests into a temporary directory, runs them and removes the temporary output. There is no configured lint script or ESLint dependency. GitHub Actions uses `npm ci`, typecheck, tests and build; the workflow runs after you create/push a GitHub repository. Nothing publishes or deploys automatically.

## Technology and folders

Runtime dependencies: React, React DOM and `@supabase/supabase-js` (loaded only in live mode). Tooling: TypeScript, Vite and its React plugin; `@electric-sql/pglite` for database tests. No map SDK, router or state-management dependency is installed.

```text
src/
  main.tsx                         # SettingsProvider + commuter entry
  styles.css                       # Shared responsive layout/theme tokens
  shared/{settings,i18n}/           # One settings/language system
  apps/
    commuter/
      CommuterApp.tsx               # Screen composition and local guest state
      components/                  # Shell, sheets, timeline, onboarding, cards
      pages/                       # Routes, fares, queues, alerts, settings, support
      hooks/                       # Requests, modal focus and storage
      services/                    # Typed contracts, demo catalog, active catalog, Supabase adapters
      lib/                         # One route engine, fare/queue/advisory utilities
      data/                        # Illustrative fixtures, never a production DB
      types.ts                     # Existing commuter models
      types/                       # Route, RoadWatch and support models
    admin/                         # Reserved future dashboard; not implemented
supabase/                          # Migrations, RLS, RPCs, generated demo seed, DB tests
scripts/test.mjs                    # Dependency-free test runner
tests/                             # Focused Node tests
.github/workflows/ci.yml            # Validation only
docs/BACKEND_INTEGRATION.md         # Backend setup, live/demo switch, contracts, tests
docs/BACKEND_HANDOFF.md             # Original frontend handoff (contracts honoured by the backend)
docs/FRONTEND_AUDIT.md              # Current audit and exact change inventory
preview/                           # Historical standalone showcase; not app entry
```

## Implemented commuter features

- First-time welcome and four English/Filipino introduction slides, skip/completion persistence and Settings replay.
- Searchable local places/manual addresses; optional landmarks and notes; recent/saved-trip endpoints; clear and safe swap.
- One bounded directed-graph route engine; fastest, cheapest, waiting and transfer priorities; selection, alternatives and leg-by-leg boarding timeline.
- FareGuard selected-journey comparison and a separately labeled distance-based sample calculator. Missing passenger fares stay unavailable.
- QueueSense local reports, filtering, expiry and matching route estimate/ranking changes.
- RoadWatch search/filter/sort/detail, status/freshness checks, grounded effects, actual mapped alternatives and no-alternative state.
- Para Alerts watched journeys, saved-guide matches and local category preferences, without background notifications.
- Browser-local saved guides, readable legacy guides, Settings, support FAQ, draft/history, validation and truthful demo-message status.
- English/Filipino; Light/Dark/System; text scales 90/100/110/120/130%; internal scroll, safe-area CSS and four fixed navigation tabs.

**Map status:** Map preview/Expand Map opens an unavailable-state panel and the selected computed guide. There are no map tiles, verified coordinates, geometry, geographic markers or coordinate-based step focusing. A real interactive commute map remains unimplemented.

## Data and offline limitations

All current transport connections, stop instructions, signboards, fare entries, waits and advisories are illustrative. Their labels must stay visible until verified data is integrated. Local reports are unverified and expire after 30 minutes for route estimates. Advisory timestamps are simulated and reset with the demo provider. No report is shared across devices.

LocalStorage is browser-origin-specific persistence, not authentication, a database or encrypted storage. Optional address notes and support contact fields stay on the device; do not enter sensitive personal information. Invalid stored values fall back safely. Settings reset changes only the three settings, never saved trips, introduction completion or support history. Storage failure keeps the session usable and displays a warning; queue submission reports failure rather than claiming a saved result.

The loaded app can use bundled demo data without network requests, but there is no service worker, offline install/cache guarantee or native Capacitor build. Refreshing without cached assets may fail offline.

## Backend and environment

The Supabase backend lives in `supabase/` (migrations, Row-Level Security, RPCs, generated demo seed, tests). The commuter app keeps its single route engine and UI; Supabase is the data source. Start with [BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md); admin contracts are in [ADMIN_DATA_CONTRACTS.md](docs/ADMIN_DATA_CONTRACTS.md) and security/privacy notes in [BACKEND_SECURITY_PRIVACY.md](docs/BACKEND_SECURITY_PRIVACY.md).

| Variable | Purpose |
| --- | --- |
| `VITE_SAKAYWISE_DATA_MODE` | `demo` (default) or `live` |
| `VITE_SUPABASE_URL` | Project URL (live mode) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`); legacy `VITE_SUPABASE_ANON_KEY` also accepted |

Copy `.env.example` to `.env.local`. In live mode a missing/invalid configuration or failed load shows an error with retry; demo data is never substituted silently. Guests stay account-free: an anonymous Supabase session is created only when they first submit a queue report or support message, and Row-Level Security scopes their data to that session. Only the project URL and publishable key may appear in `VITE_` variables — the app refuses to start with a secret/service-role key. Never use a frontend `isAdmin` flag as authorization; admin roles are enforced in the database.

## GitHub collaboration

This supplied directory currently has **no `.git` repository**. Review [GITHUB_WORKFLOW.md](docs/GITHUB_WORKFLOW.md) before manually initializing a repository or uploading files. No commit, remote or push was created by the audit.

After cloning the team's repository:

```sh
npm ci
git switch -c feature/your-module
# Make a focused change, then:
npm run typecheck
npm test
npm run build
git status --short
git diff
```

Stage only reviewed source/configuration files, inspect `git diff --cached`, then create your own commit/PR. Keep `node_modules`, `dist`, real `.env` files, credentials and local editor state excluded. Agree on stable IDs and service contracts before changing shared types. Develop the future dashboard under `src/apps/admin/` on its own branch; preserve the commuter application.
