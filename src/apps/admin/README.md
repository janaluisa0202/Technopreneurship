# SakayWise Admin (website)

Desktop-first admin console for SakayWise. Same palette and type as `src/styles.css` (light + dark).

## Opening it

Run `npm run dev`, go to `http://localhost:5173/` and sign in. Admin accounts are sent to `/admin.html` automatically.
Demo admin: `admin@sakaywise.demo` / `SakayWise-Admin1` (demo mode only; live mode uses Supabase accounts). The admin site has no login page of its own; it uses the shared
login at `/`. See `src/shared/README.md` for all demo accounts and the backend handoff.

## Modules

| Sidebar | What it does |
|---|---|
| Dashboard | Summary cards (active promos, open support, active incidents, unread, pending queue reports) + recent support, incidents, announcements |
| Promos | Add, edit, delete, activate/deactivate; status is Active / Upcoming / Inactive / Expired |
| Help Center | Inbox with search, status + issue-type filters, thread view, reply, Pending/Resolved, spam flag, quick replies |
| Incidents / RoadWatch | Post, edit, resolve, remove advisories with category, severity, area, time window |
| Direct Messages | One commuter, all users (with confirmation) or a route; announcement / advisory / promo types |
| Queue Reports | Approve, reject or flag spam; latest approved status per terminal and freshness (30-minute rule) |
| Announcements | Draft → publish → archive for Para Alerts, RoadWatch, promo or general channels |
| Users | Customer accounts: search, active/inactive, message history |
| Activity Log | Who did what, filterable by admin and module |
| Settings | Account info, light/dark/system theme, reset demo data (owners) |

## How data works

**Live mode** (`VITE_SAKAYWISE_DATA_MODE=live`): sign in at `/` with a Supabase account that has a row in
`admin_role_assignments`. Every module reads and writes Supabase through `services/liveStore.ts` (same function names
as the demo store, all async). Changes appear in the commuter app (support chat, RoadWatch, Para Alerts → Updates), and
customer activity appears here. Refresh uses Realtime plus 45-second polling. See `docs/ADMIN_SUPABASE_INTEGRATION.md`.

**Demo mode** (default): unchanged. Admin data lives in `localStorage` (`sakaywise:admin:v2`, fictional seed in
`services/seed.ts`); Help Center and customer accounts are shared with the commuter app through browser storage, so
they only meet in the same browser. Published announcements, active promos and broadcasts also show in the demo
commuter app's Para Alerts → Updates.

Pages only use `adminStore` / `useAdminState` from `services/store.ts`, which picks the demo or live implementation.

## Security note

Do not rely on a frontend-only role check. In live mode every action is enforced by Row-Level Security and security-definer RPCs; the redirect to `/admin.html` is only a convenience.
