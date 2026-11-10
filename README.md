# SakayWise commuter frontend

SakayWise is a mobile-first Philippine commuter **academic prototype**, built with React, TypeScript and Vite. It compares explicitly mapped sample journeys, passenger-specific sample fares, local queue reports and simulated road advisories. Commuters can use it without an account.

**This is ready for frontend/backend collaboration, not live travel guidance.** No Supabase client, backend, official fare feed, live traffic/GPS, push notifications or geographic map is connected. Support messages remain on the current device and are not sent to an administrator.

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
npm run build
npm run preview
```

`npm test` compiles the TypeScript Node tests into a temporary directory, runs them and removes the temporary output. There is no configured lint script or ESLint dependency. GitHub Actions uses `npm ci`, typecheck, tests and build; the workflow runs after you create/push a GitHub repository. Nothing publishes or deploys automatically.

## Technology and folders

Runtime dependencies: React and React DOM. Tooling: TypeScript, Vite and its React plugin. No map SDK, Supabase SDK, router or state-management dependency is installed.

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
      services/                    # Typed contracts, central demo catalog/adapters
      lib/                         # One route engine, fare/queue/advisory utilities
      data/                        # Illustrative fixtures, never a production DB
      types.ts                     # Existing commuter models
      types/                       # Route, RoadWatch and support models
    admin/                         # Reserved future dashboard; not implemented
scripts/test.mjs                    # Dependency-free test runner
tests/                             # Focused Node tests
.github/workflows/ci.yml            # Validation only
docs/BACKEND_HANDOFF.md             # Backend developer's starting point
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

## Backend modules and environment

The next developer should start with [BACKEND_HANDOFF.md](docs/BACKEND_HANDOFF.md). Required modules include transport/place catalog, versioned fare matrices, queue ingestion/moderation, verified advisory publication, guest-scoped support conversations/messages, administrator authentication/authorization and RLS. Do not create another route engine or replace the commuter UI.

No environment file is needed for current demo mode. `.env.example` contains only commented future public frontend placeholders. Copying it to `.env.local` **does not activate Supabase**. The backend developer must deliberately implement/configure adapters, runtime payload validation, loading/retry states and provenance-aware labels before enabling remote data.

Only a project URL and public anon/publishable credential may enter browser `VITE_` configuration. Private/service-role keys and database passwords must remain in server-side secrets. Never use a guest UUID or frontend `isAdmin` flag as authorization. Do not commit real `.env` files.

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
