# RoadWatch, personalization and commuter support

Implemented in the existing commuter application. The reserved admin application is unchanged. No dependencies, live services, map library, or GitHub push were added.

## RoadWatch behavior

Para Alerts contains RoadWatch and My Alerts; the same four bottom navigation items remain. The feed supports search, category/severity/status filters and recent/severity/relevance sorting. Detail sheets show provenance, timestamps, mapped affected connections and alternatives computed by the existing route engine.

The local provider explicitly returns simulated advisories. Validation rejects invalid calendar dates, inconsistent timestamp order, unsupported statuses and scheduled records without a start. Duplicate IDs use the latest valid update. Scheduled effects apply at their start, stop at their end, and become stale after 24 hours without an update. Resolved, expired, unknown, future-updated and stale records do not impose current operational effects. The hook refreshes at time boundaries and when the page regains focus.

Impacts match explicit segment, stop, service or route identifiers. Text similarity, severity and a nearby place name cannot close a route or invent a delay. Confirmed simulated closures/interruption exclude matched paths before ranking. A future verified provider must meet the same confirmation rules. Only evidenced, explicitly supplied additional travel minutes are added. Related incidents use a single maximum estimate; applying the same impacts twice is idempotent. Queue-overlap and unsupported estimates add no time. Queue waiting remains separate.

Route banners compare the affected original and an available alternative from the same graph, using the same passenger fare and queue utilities. When none exists, the app says so. Personal category and saved-trip preferences control highlights and badges without disabling routing restrictions. Older saved guides without segment snapshots remain readable but do not acquire fabricated precise matches. Route watches, reports and guides remain local.

Only verified official HTTPS sources on the explicit trusted-host allowlist can expose an official-source action. Demo data contains no invented official links. There was no map implementation in this checkout: no geometry, markers, geocoding, routing API or map view was fabricated.

### Repeatable demonstration

Run `npm run dev`. Choose UST Frassati (España) → SM North EDSA / Annex and Fastest route. Submit a Low queue report for UST España if older reports are affecting your comparison. Open these development-only fixtures:

| URL | Expected behavior |
| --- | --- |
| `http://localhost:5173/?roadwatchDemo=clear` | Three mapped options; no matching advisory in the available data. This does not assert actual road safety. |
| `http://localhost:5173/?roadwatchDemo=closure` | UV and jeepney paths unavailable; mapped LRT + MRT alternative displayed. |
| `http://localhost:5173/?roadwatchDemo=no-alternative` | All mapped departures blocked; explicit no-alternative message and location controls remain. |
| `http://localhost:5173/` | Mixed sample feed with closure, explicit delay, uncertain warning, unrelated, scheduled, resolved and expired examples. |

Fixture timestamps are relative to module load. Reload restarts the simulation. Query overrides are ignored in production builds. None represents actual conditions.

## Settings and accessibility

The header gear opens a full in-app Settings panel. Back preserves the selected commuter tab. Settings provide English/Filipino, Light/Dark/System and 90/100/110/120/130 percent text. System is the default; its media-query listener responds to device appearance changes. An early validated HTML bootstrap applies persisted preferences before React paints. Shared semantic colors cover backgrounds, cards, inputs, warnings and overlays; brand colors remain consistent.

Typed English and Filipino resources share keys, with English fallback, parameter substitution and helpers for dynamic instructions. Place names, route IDs, vehicle signboards, addresses and user-written content are preserved. Document language, currency and timestamp formatting follow the selected language. Text uses relative units while controls retain at least 44px touch targets and form fields retain a 16px minimum. Flex children and scrolling regions use `min-height: 0`; panels remain inside the phone viewport. The support control has reserved space above navigation and hides with modal panels and focused text fields.

Preferences use `sakaywise:settings:v1`; malformed values fall back safely. Reset requires confirmation and changes only language, appearance and text size. It never clears trip, address, alert or support storage.

## Support Center and future integration

Both Settings and the floating support control open the same Support Center, with seven localized expandable FAQs and a message composer. Optional category, nickname, email and related-trip fields require no account or precise location. Messages reject empty text, more than 2,000 characters, invalid optional email, repeated submissions and storage failures. Drafts and local history restore after reload. Message subscriptions do not fire for draft changes, so typing cannot drag the conversation scroll position.

Repository inspection found no configured Supabase client, SDK, authenticated endpoint, support tables, RLS policies or verified support email. The adapter is therefore **local demo only**, stored under `sakaywise:support:v1`. The screen explicitly states: “Demo chat — messages are saved on this device and are not sent to an administrator.” It never generates administrator replies, online presence, delivered states or read receipts. Saved optional contact details are not emailed. Guest IDs identify local records and are not authentication credentials.

`SupportService` separates UI from persistence: `createConversation`, `updateConversationMetadata`, `sendMessage`, `getConversationMessages`, `getConversationsForSession`, `subscribeToMessages`, `markConversationRead`, `getDraft` and `saveDraft`. Future backend work must supply a real adapter, verified delivery acknowledgments and real subscriptions. It requires server-issued guest authorization/capabilities or authenticated sessions, authenticated administrator roles, server-side ownership enforcement/RLS, input validation, rate limits, idempotency and deliberate retention/deletion rules. Never authorize access using a client-supplied guest UUID alone; never ship an administrator/service key in Vite variables. Read/delivery labels must be derived from actual server events. The reserved dashboard and backend are not implemented here.

## Verification

- `npm run typecheck` and `npm run build`.
- 53 focused Node tests: search/address identity, graph routing, fares, queue expiry, advisory validation/matching/impacts/personalization, translations, settings restoration/system changes, support validation/persistence/duplicates/quota errors and invalid stored timestamps.
- Browser checks at 320×568, 375×667, 390×844, 430×932, 812×375 landscape, 390×420 shortened viewport and 1440×900 desktop. Filipino 130% dark layout: four tabs, advisory details, My Alerts, Settings, FAQ, support chat, route details, location search and address form. No horizontal overflow or undersized controls in these checks. English/light at 90% retains minimum 16px inputs.
- Browser interactions: settings reload/reset, FAQ, optional email error, support draft/history restoration, queue-driven reranking, FareGuard, saved guides, watch preference restoration and all three development fixtures.

The shortened viewport simulates reduced available height, not a physical mobile keyboard. Real-device safe areas, native keyboard behavior, screen-reader usability and native Capacitor integration still require device testing. Sample routes, fares and advisories need verified datasets before production use. No live GPS, LTFRB feed, push service, administrator messaging or official road feed is connected.

To reproduce automated checks without extra dependencies:

```sh
npm run typecheck
npm run build
./node_modules/.bin/tsc --target ES2022 --module commonjs --moduleResolution node --skipLibCheck --outDir /private/tmp/sakaywise-complete-tests tests/locations.test.ts tests/routeEngine.test.ts tests/roadwatch.test.ts tests/settingsSupport.test.ts
node --test /private/tmp/sakaywise-complete-tests/tests/*.test.js
```

## File inventory for Parts 5 and 6

Created:

- `src/vite-env.d.ts`
- `src/shared/settings/settings.ts`
- `src/shared/settings/SettingsProvider.tsx`
- `src/shared/i18n/en.ts`
- `src/shared/i18n/fil.ts`
- `src/shared/i18n/translate.ts`
- `src/shared/i18n/index.ts`
- `src/apps/commuter/types/roadwatch.ts`
- `src/apps/commuter/types/support.ts`
- `src/apps/commuter/data/roadwatchDemoData.ts`
- `src/apps/commuter/lib/roadwatchService.ts`
- `src/apps/commuter/lib/advisoryImpact.ts`
- `src/apps/commuter/lib/roadwatchPersonalization.ts`
- `src/apps/commuter/lib/supportService.ts`
- `src/apps/commuter/hooks/useRoadWatch.ts`
- `src/apps/commuter/hooks/useSupportCenter.ts`
- `src/apps/commuter/components/ApplicationPanel.tsx`
- `src/apps/commuter/components/roadwatch/RoadWatchCard.tsx`
- `src/apps/commuter/components/roadwatch/RoadWatchFilters.tsx`
- `src/apps/commuter/components/roadwatch/RoadWatchSummary.tsx`
- `src/apps/commuter/components/roadwatch/RoadWatchBanner.tsx`
- `src/apps/commuter/components/roadwatch/RoadWatchDetails.tsx`
- `src/apps/commuter/pages/SettingsPage.tsx`
- `src/apps/commuter/pages/SupportCenter.tsx`
- `tests/roadwatch.test.ts`
- `tests/settingsSupport.test.ts`
- `docs/ROADWATCH_SETTINGS_SUPPORT.md`

Modified:

- `index.html` — early appearance/language/text bootstrap.
- `src/main.tsx` — shared Settings provider.
- `src/styles.css` — semantic light/dark palette, relative typography, panel/support layouts and translated-label wrapping.
- `src/apps/commuter/CommuterApp.tsx` — advisory routing, personal preferences, panels and translated feedback.
- `src/apps/commuter/types.ts` — advisory sheet state.
- `src/apps/commuter/types/route.ts` — advisory metrics and impacts.
- `src/apps/commuter/data/transportNetwork.ts` — stable service IDs.
- `src/apps/commuter/lib/routeEngine.ts` — advisory-aware analysis before route ranking.
- `src/apps/commuter/lib/commute.ts` — localized peso formatting.
- `src/apps/commuter/lib/queues.ts` — localized report times.
- `src/apps/commuter/hooks/useRouteRecommendations.ts` — advisories, clock and unavailable/baseline results.
- `src/apps/commuter/hooks/useModalFocus.ts` — focus handling for panels and anchors.
- `src/apps/commuter/components/MobileShell.tsx` — settings/support controls, badge, localized navigation.
- `src/apps/commuter/components/Icon.tsx` — required settings/support/advisory icons.
- `src/apps/commuter/components/Sheets.tsx` — advisory sheet, localized existing guides/reports.
- `src/apps/commuter/components/RouteDetails.tsx` — impacts and localized instructions/fares.
- `src/apps/commuter/components/LocationPicker.tsx` — localized search/error/accessible labels.
- `src/apps/commuter/components/AddressDetailsForm.tsx` — localized address fields and validation.
- `src/apps/commuter/pages/RoutesPage.tsx` — advisory banner, alternatives and localization.
- `src/apps/commuter/pages/FareMatrixPage.tsx` — localization and quoted-fare validation.
- `src/apps/commuter/pages/QueuesPage.tsx` — localization.
- `src/apps/commuter/pages/AlertsPage.tsx` — RoadWatch/feed/watch preferences and localization.
- `tests/routeEngine.test.ts` — advisory-delay metric expectations.

Earlier mobile-shell/location/route work in this chat is documented separately in `SMART_ROUTE_RECOMMENDATIONS.md` and the existing implementation notes.
