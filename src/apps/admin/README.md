# SakayWise Admin (website)

Desktop-first admin console for SakayWise. Same palette and type as `src/styles.css` (light + dark).

## Opening it

Run `npm run dev`, go to `http://localhost:5173/` and sign in. Admin accounts are sent to `/admin.html` automatically.
Demo admin: `admin@sakaywise.demo` / `SakayWise-Admin1`. The admin site has no login page of its own; it uses the shared
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

## How data works right now

- Admin-only data (promos, incidents, announcements, queue reports, sent messages, activity) is in `localStorage`
  (`sakaywise:admin:v2`), starting from fictional seed data (`services/seed.ts`).
- Help Center conversations and customer accounts are shared with the commuter app (`src/shared/messaging`,
  `src/shared/auth`): a customer's message appears here and an admin reply appears in the customer's Help & Support chat.
- A message to **one** commuter lands in that customer's chat. Messages to all users or a route are only recorded here
  until the backend can deliver them. Promos, announcements and advisories don't reach the commuter app yet.
- Everything the pages do goes through `adminStore` in `services/store.ts`; re-implement it with API calls for the backend.

## Security note

Do not rely on a frontend-only role check. The backend must enforce admin permissions on every action.
