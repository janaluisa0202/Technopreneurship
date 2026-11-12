# Shared: login + customer ⇄ admin chat

## How sign-in works

`/` is the only front door. `src/shared/AppRoot.tsx`:

- not signed in → `LoginPage` (sign in, create account, forgot password)
- signed in as **admin** → redirected to `/admin.html` (the admin website)
- signed in as **customer** → the commuter app, showing their own account (Settings → Account, with Sign out)

`/admin.html` checks the same session. No session or a customer account → sent back to `/`.

## Demo accounts (browser only)

| Role | Email | Password |
|---|---|---|
| Admin (owner) | `admin@sakaywise.demo` | `SakayWise-Admin1` |
| Admin (moderator) | `ops@sakaywise.demo` | `SakayWise-Admin1` |
| Customer | `mika@sakaywise.demo` (also carlo, bea, jun, lia, rina) | `SakayWise-User1` |

Customers can also create their own account on the login page (stored hashed in this browser).

## Backend handoff — what to replace

Keep the function names; swap the bodies for API calls. Nothing else in the UI has to change.

| File | Replace with |
|---|---|
| `shared/auth/authService.ts` → `authService` (`login`, `register`, `requestPasswordReset`, `restoreSession`, `logout`) | Your auth API. The **server** must decide the user's role (`admin` / `customer`) and refuse admin endpoints to customers. The browser-side redirect is only a convenience. |
| `shared/auth/authService.ts` → `customerDirectory` | An admin-only "list customers" endpoint (used by the admin Users page and the Direct Messages recipient list). |
| `shared/messaging/supportStore.ts` → `supportStore` | Conversation endpoints + realtime (websocket / Supabase realtime / SSE) instead of the `storage` event. Customer calls must be limited to the signed-in customer's own conversations by the server. |
| `apps/commuter/lib/accountSupportService.ts` | Already implements the commuter `SupportService` interface — point each method at the API. |
| `apps/admin/services/store.ts` → `adminStore` | Promos, incidents, announcements, queue reports, direct messages, activity log. |

Remove `DEMO_MODE`, the demo-password constants and the demo box on the login page when real auth is connected.

## Known demo limits

- Everything is stored in this browser's `localStorage`, so customer and admin see each other's messages only when both
  tabs are open on the same origin (same `localhost:5173`).
- The commuter app's own data (saved trips, alerts, settings) is not separated per account yet. Two customers on the same
  browser share it. Per-account data needs the backend.
- Messages to "all users" or a route are recorded in the admin console only; customers don't have a broadcast inbox yet.
