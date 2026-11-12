# Admin dashboard ⇄ commuter app ⇄ Supabase

Integration of the admin website (merged from `main`) with the Supabase backend, on branch `integration/admin-supabase` (based on `feature/backend-integration` @ `d61f0d6`). Feature-by-feature inventory and status: [ADMIN_INTEGRATION_INVENTORY.md](ADMIN_INTEGRATION_INVENTORY.md). Earlier backend work: [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md).

## What changed, in one paragraph

In **live mode** (`VITE_SAKAYWISE_DATA_MODE=live`) the shared login uses **Supabase Auth**, and whether someone is an admin is decided by the **server** (`my_admin_roles()`). Every admin module reads and writes Supabase through one data layer (`apps/admin/services/liveStore.ts`), which has the same API the pages already used. Customers and admins exchange the **same rows**: support conversations/messages, queue reports, road advisories, plus new promos, announcements and staff messages. These now reach the commuter app through a new *Para Alerts → Updates* section. Authorization is enforced by Row-Level Security and security-definer RPCs, and never by the browser. **Demo mode is unchanged**: browser-only accounts and `localStorage` stores, now kept strictly separate from live mode.

## Data flow per feature

| Flow | Direction | Backend records |
| --- | --- | --- |
| Sign-up / sign-in / reset | user → Auth | `auth.users` → `profiles` (trigger) |
| Support chat | commuter ⇄ admin | `support_conversations`, `support_messages` (`support_*` RPCs) |
| Direct message to one commuter | admin → that commuter's chat | `admin_send_message` → `support_messages` + `admin_messages` |
| Broadcast (all users / route) | admin → commuters' Updates | `admin_messages` (audience `all`/`route`) |
| Announcements | admin → commuters' Updates | `announcements` (published only) |
| Promos | admin → commuters' Updates | `promos` (active and in date only) |
| Incidents / RoadWatch | admin → commuters' RoadWatch | `road_advisories` (`source_type = 'operator'`) |
| Queue reports | commuter → admin moderation → commuter estimates | `queue_reports`, `get_queue_estimates()` |
| Users | accounts → admin | `profiles`, `admin_list_users()` |
| Activity log | every admin write / event → admin | `admin_audit_log` (triggers + `admin_log_event`) |
| Dashboard KPIs | derived | same loaded records as the module pages (definitions in the inventory) |

Refresh: Supabase Realtime where available, plus a **polling fallback** (admin: every 45 s and on window focus; commuter support: 20 s; updates, queues, RoadWatch: 60 s). The fallback was the only mechanism in the local end-to-end run, which had no Realtime server.

## Database migration `20261112120000_admin_dashboard_integration.sql`

Additive and safe to apply on the existing project (it creates new objects, adds one column with a default, and widens three CHECK constraints). Existing rows are kept.

| Object | Purpose | Security |
| --- | --- | --- |
| `profiles` + trigger on `auth.users` + backfill | Display names / emails for admin pages; `last_seen_at` | Owner reads own row; staff read all; owner may update only `display_name` |
| `touch_profile()` | Updates `last_seen_at` (at most every 5 min) | Signed-in users |
| `admin_list_users(query, limit, offset)` | Commuter accounts with conversation counts (excludes staff and idle guests) | Staff only |
| `support_conversations.flagged_spam` + `support_set_spam()` | Help Center spam filter | Support roles |
| `support_mark_unread()` | Help Center "Mark unread" (clears the newest commuter read receipt) | Support roles |
| Activity triggers on `support_conversations` / `support_messages` | "Replied to commuter", "Marked concern …", spam actions (no message bodies) | — |
| `queue_reports.moderation_status` += `spam`; `get_queue_estimates()` excludes `spam` | Admin "Spam" outcome | Moderators (existing policy) |
| `road_advisories.source_type` += `operator` | Staff-posted incidents, labelled "SakayWise advisory" (never "official") | Transport managers (existing policy) |
| `promos` | Promo management | Public reads active, in-date rows; staff CRUD |
| `announcements` (+ `published_at` stamp) | Announcements | Public reads published rows; staff CRUD |
| `admin_messages` + `admin_send_message()` | Direct/broadcast messages; `one` is delivered into the commuter's support thread | Signed-in users read `all`/`route`; staff send; only support roles can write into a thread |
| `admin_audit_log.detail`, `action` += `EVENT`, `admin_log_event()` | Readable activity entries, sign-in/out | Admins read (existing policy) |
| Realtime publication += `promos`, `announcements`, `admin_messages`, `queue_reports` | Live refresh | RLS applies to events |

"Staff" means any active role among `admin`, `support_staff` and `transport_data_manager`, or `super_admin`.

## Setup changes for the hosted project

1. `npx supabase db push` (applies the new migration).
2. **Authentication → Providers → Email**: enabled. For a classroom demo you can turn off "Confirm email". With it on, new users get a confirmation link and the app shows "Confirm your email".
3. **Authentication → URL Configuration**: set *Site URL* to where the app is hosted and add it to *Redirect URLs*. The password-reset link returns there, and the app shows a "Set a new password" form.
4. Anonymous sign-ins are **no longer required** (commuters now sign in). Leaving them enabled is harmless.
5. Bootstrap admins (SQL editor), then sign in at `/` with that account:
   ```sql
   insert into public.admin_role_assignments (user_id, role)
   select id, 'super_admin' from auth.users where email = 'owner@example.com';
   -- other staff: 'admin' | 'support_staff' | 'transport_data_manager'
   ```
   UI mapping: `super_admin` = "Owner", any other role = "Moderator". What a moderator can do depends on their actual role, enforced by the database.

## Role capabilities (server-enforced)

| Module | support_staff | transport_data_manager | admin / super_admin |
| --- | --- | --- | --- |
| Help Center, direct message to one commuter | ✓ | — | ✓ |
| Incidents, queue moderation | — | ✓ | ✓ |
| Promos, announcements, broadcasts, users list | ✓ | ✓ | ✓ |
| Activity log | — | — | ✓ |
| Role management | — | — | super_admin |

A forbidden action shows "Your admin role does not allow this action" and nothing is saved (verified end-to-end).

## Files

**Added:** `supabase/migrations/20261112120000_admin_dashboard_integration.sql`, `supabase/db-tests/admin_integration.test.mjs`, `src/shared/backend/runtime.ts`, `src/shared/auth/liveAuthService.ts`, `src/shared/auth/roles.ts`, `src/apps/admin/services/liveStore.ts`, `src/apps/admin/services/liveMappers.ts`, `src/apps/admin/lib/actions.ts`, `src/apps/commuter/services/supabase/updatesService.ts`, `src/apps/commuter/hooks/useCommuterUpdates.ts`, `src/apps/commuter/types/updates.ts`, `tests/adminIntegration.test.ts`, `docs/ADMIN_INTEGRATION_INVENTORY.md`, this file.

**Modified:** `src/shared/AppRoot.tsx`, `src/admin-main.tsx`, `src/shared/auth/{authService.ts,types.ts,LoginPage.tsx}`, `src/shared/messaging/types.ts` (`closed` status), `src/apps/admin/{AdminApp.tsx,types.ts,services/store.ts}`, every admin page (actions now await the server; mode-aware notices), `src/apps/commuter/{CommuterApp.tsx,pages/AlertsPage.tsx,hooks/useSupportCenter.ts,components/CommuterDataGate.tsx,types/roadwatch.ts,lib/roadwatchService.ts}`, `src/apps/commuter/services/supabase/{client.ts,remoteServices.ts}`, `src/shared/i18n/{en,fil}.ts` (20 strings), `supabase/db-tests/{harness.mjs,supabase_shim.sql}`, docs.

**Removed:** nothing. The demo stores (`shared/messaging/supportStore.ts`, admin `services/seed.ts`, demo accounts) remain for demo mode.

## Calculation / definition changes

- *Unread messages* (live) = a commuter message with no server read receipt. Opening a conversation in the Help Center records the receipt.
- *Pending queue reports* (live) = unreviewed reports from the last 7 days (the loaded window).
- Unreviewed community queue reports still count toward commuter estimates as "not verified" until rejected or marked spam (see the inventory for why).
- Conversation status `closed` (already in the database) is now shown in the admin UI; a closed conversation makes the commuter's next message start a new one.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` (frontend) | 90 / 90 (82 existing + 8 new) |
| `npm run test:db` (PGlite: migrations, RLS, RPCs) | 55 / 55 (45 existing + 10 new) |
| `npm run seed:check` | up to date |
| `npm run build` | pass (`index.html` + `admin.html`) |
| Live end-to-end (Chromium, PostgreSQL 16 + PostgREST 12 + Supabase-Auth-compatible stub, **no Realtime**) | 25 / 25 steps: register → support message → queue report → admin sign-in by server role → KPIs from live records → read receipt → reply → spam moderation → incident → announcement → promo → route + all-users broadcast → users list → audit entries → commuter badge (polling) → reply shown and receipt → reload keeps session → spam excluded from estimates → incident in RoadWatch → Updates feed → unpublish reflected → customer blocked from `/admin.html` → customer JWT rejected by RLS on admin tables → support_staff blocked from audit log and incidents → admin sign-out / sign-in |
| Demo-mode regression (Chromium) | pass; contacts only its own origin |

## Known limitations / not verified

- **Not run against the hosted project** (`fqnehnuukrtkrlmooacj`): no credentials here. Apply the migration and test there.
- **Supabase Realtime and real email delivery were not exercised.** The auth server in the end-to-end run was a compatible stub (not GoTrue), so email confirmation and reset emails were not sent.
- The admin loads bounded windows: 200 newest conversations (up to 5,000 messages), 500 promos/announcements, 300 incidents, 200 sent messages, 7 days of queue reports, 500 users, 300 audit entries. There is no "load more" UI yet.
- Route broadcasts match a commuter's current, watched or saved journey **on the device**. The server never tracks commuter routes, so commuters who have not planned or saved that route do not see the message.
- Admin route targeting lists the *popular journeys* only.
- Admin-posted incidents are informational: they do not block or delay routes, because the admin form has no segment/stop mapping UI yet (the database supports explicit impacts).
- Saved trips, addresses, alert preferences and settings remain per-device (tables for account sync exist but are not wired).
- Main bundle is ~300 kB; the admin bundle now includes the live data layer (97 kB).

## Remaining work

1. Apply the migration to the hosted project; configure Email auth and redirect URLs; bootstrap admins; repeat the end-to-end checks there.
2. Admin UI for mapping incidents to segments/stops (to let staff advisories affect routing), and for transport/fare management (database and RLS are ready).
3. "Load more" pagination in the Help Center and Activity log.
4. Per-account sync of saved trips and preferences.
5. Schedule `private.purge_expired_data()` once retention periods are agreed.
