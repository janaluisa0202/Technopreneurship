# SakayWise backend handoff

Read this before adding Supabase. The frontend is a functioning local academic demo. There is no configured backend, client SDK, Auth, RLS, server endpoint, realtime subscription, push service or geographic map. The audit adds contracts and demo adapters, **not backend implementations**. No environment variable currently changes data mode.

## Data-access boundaries and actual wiring

- `src/apps/commuter/services/contracts.ts`: typed network, route-information/catalog, fare-matrix and queue service interfaces. `CommuterDataServices` composes those with the existing `RoadWatchProvider` and `SupportService`.
- `services/demoCatalog.ts`: single explicit import boundary for bundled fixtures. UI, hooks and domain utilities no longer import individual fixture files. This remains a synchronous, explicitly demo catalog; it is not a remote cache or a live fallback.
- `services/demoServices.ts`: executable async demo read adapters and an injectable local queue adapter. Read results are copies with `provenance: 'illustrative-demo'`, source name and retrieval timestamp. Queue submission is wired into `CommuterApp`; its repository delegates to the **existing** local report state/store, not another database.
- Network/catalog/fare async adapters are contract/reference implementations. The current engine/UI still use the same synchronous demo catalog. They are **not** already connected to an asynchronous global remote-data loader. Integrating a remote snapshot deliberately is a backend/frontend integration step, not an env-only switch.
- Existing `hooks/useLocationSearch`, `hooks/useRoadWatch` and `hooks/useSupportCenter` accept provider/service seams. Do not add duplicate providers, a second support chat or a second route engine.

## Existing models and required payloads

Existing types remain under `types.ts`, `types/route.ts`, `types/roadwatch.ts`, `types/support.ts`. The audit does not change their shapes.

| Service | Input | Output |
| --- | --- | --- |
| `TransportNetworkService.getNetwork` | optional `{signal}` | `DataResult<TransportNetwork>` |
| `RouteInformationService.getCatalog` | optional `{signal}` | `DataResult<{places, popularJourneys, legacyTrips}>` |
| `getRouteInformation` | stable `serviceId`, optional `{signal}` | `DataResult<{serviceId,segments} \| null>` |
| `FareMatrixService.getMatrices` | optional `{signal}` | `DataResult<{segmentFares, distanceProfiles}>` |
| `QueueReportService.getReports` | optional `{signal}` | `DataResult<QueueReport[]>` |
| `submitReport` | `{terminal,level,details?,requestId}` | `DataResult<QueueReport>` after actual persistence |
| `RoadWatchProvider.load` | none | `{advisories:unknown[], retrievedAt, label}`; hook validates records |
| `LocationSearchProvider.search` | query string | `Place[]`; ignore obsolete query responses |
| `SupportService` | draft/conversation ID/message/request ID | existing conversation/message models and message subscription disposer |

`DataResult<T>` adds `provenance: illustrative-demo | verified-source | community-unverified`, `sourceName`, ISO `retrievedAt`, optional source `updatedAt`. A retrieval timestamp is not an incident timestamp or proof of current conditions. Reject malformed payloads; do not silently substitute demos when a live request fails. Honor AbortSignal; represent unknown services as null/empty rather than invented routes. Domain-specific errors must drive visible errors/retry, not success toasts.

### Network and route engine

`TransportNetwork = {nodes:TransportNode[], segments:TransportSegment[]}`. Nodes carry stable `id`, optional `placeId` and `areaId`. Segments carry `id/from/to/mode/service/serviceId/signboard/boarding/alighting/instruction`, minute values, passenger fare table and optional per-terminal queue assumptions. Modes are walk, jeepney, modern-jeepney, uv, bus, mrt, lrt and tricycle. References must resolve, durations must be finite/nonnegative and service IDs must stay stable across catalogs, queues and advisories.

Important current contract: the graph traversal starts from the origin place ID and reaches the destination place ID. Merely setting `node.placeId` to a different ID is insufficient: provide endpoint nodes whose `node.id` equals the selected `Place.id`, or deliberately extend/test the endpoint-resolution logic.

`lib/routeEngine.ts` is the sole planner. `analyzeRouteRecommendations(request,reports,now,network,advisories)` accepts an explicit network, returns usable top-three routes plus all/baseline results, and bounds traversal to 10 segments/3 rides/10,000 expansions/256 paths. It avoids revisits/area cycles and deduplicates equivalent rides. This is a limited demo planner, not an arbitrary metropolitan-scale routing service.

Integration must pass one validated/versioned network snapshot through `useRouteRecommendations` (currently uses the demo default), personal watch analysis, advisory lookup/matching, detail display and the catalog. Do not mix one backend graph with old demo stop/service IDs. The audit centralizes imports to make those dependencies visible; it does not pretend the snapshot loader already exists.

### Places and saved locations

`Place` currently has source `demo | manual`, optional coordinates, canonical identity and formatted address. `SelectedLocation` adds optional address detail strings. Current identity validation intentionally accepts only known demo IDs for demo places. A real provider needs an agreed additive provenance/identity update to `Place`, validators, exact manual-address resolution and UI notices; do not label remote records as demo merely to bypass validation. Preserve distinct same-name places and block equal endpoints. Current `LocationSearchProvider` has no pagination/provenance envelope; extend together with consumers if needed.

### Fares

`FareTable` is partial regular/student/senior/pwd → nonnegative amount in PHP. Missing means unavailable; never infer a universal discount. Segment fares drive route ranking, FareGuard, details and saved-guide repricing via `lib/fares.ts`. `FareMatrices.segmentFares` is keyed by stable segment ID and must be applied to the matching network version before planning. `distanceProfiles` is the separate illustrative calculator, not a legal route tariff.

Real tariffs need verified source, effective period, mode/route/operator applicability, eligibility and currency/rounding decisions. Those provenance fields belong in the backend/versioned envelope until a coordinated model change. Do not display an old saved fare or independent distance sample as an official current benchmark.

### QueueSense

`QueueReport` contains stable ID, terminal/place, optional segment ID, level low/mid/high, display text/progress and optional ISO reportedAt/isLocal. Local reports use the existing `sakaywise-v3:localReports` store. The new queue adapter validates accepted terminal choices, bounds optional text and supports request-ID idempotency within its repository.

`lib/queues.ts` currently applies only **local** reports (`isLocal`) matching terminal/segment and younger than 30 minutes; otherwise the segment's demo baseline applies. Real remote reports must not be falsely tagged local to force an effect. Agree on an additive provenance/trust model and adapt `latestQueueReport`, UI source labels, aggregation/moderation and freshness tests together. Backend timestamp/owner/expiry/moderation must be server-controlled; client progress/estimate text is not trusted evidence. Persist idempotency across server requests and rate-limit guest submissions. “No current report” must remain distinct from low queue.

### RoadWatch / Para Alerts

`RoadAdvisory` includes category, severity, status, source/verification, explicit affected route/segment/stop/service IDs, confirmation, supported delay/evidence, publication/update/start/end times and optional verified point geometry. `useRoadWatch` validates unknown records, handles unavailable/outdated data, exposes retry and refreshes effective/freshness boundaries. Feed filtering and provenance validation are in `lib/roadwatchService.ts`.

`lib/advisoryImpact.ts` matches IDs, excludes confirmed active closures/interruption and adds evidenced additional-travel delay once, without queue overlap or severity multipliers. Stale/expired/resolved/unknown/unconfirmed advisories cannot invent operational effects. Service-ID fallback for legacy snapshots and affected-stop descriptions also depend on the same network catalog. Preserve those dependencies. Official-source actions require verified provenance and an explicitly allowed HTTPS host; review the allowlist when adding a real provider.

Preferences affect personal highlights/badges, never routing safety restrictions. Old saved guides lacking segment snapshots cannot establish precise advisory matches. Watches and notification preferences do not create push subscriptions.

### Support messages

Keep `SupportService` from `types/support.ts`: createConversation, updateConversationMetadata, sendMessage, getConversationMessages, getConversationsForSession, subscribeToMessages, markConversationRead, getDraft, saveDraft. Local adapter `lib/supportService.ts` saves only commuter messages with `saved-local` status and no administrator read receipts/replies. Draft, category, nickname/email/related trip are optional local state. Current UI always shows its local demo notice/status; a remote adapter requires a coordinated provenance/status UI update before saying sent/delivered.

Suggested backend responsibilities: conversations, messages, participants/guest ownership, status, categories, timestamps, verified delivery/read events, idempotency and scoped subscriptions. Names/email must remain optional. Validate 2,000-character limit, sanitize rendering as text, rate-limit, define retention/deletion and protect contact data. Do not auto-upload existing local drafts, addresses or message history when connecting Supabase.

## Guest access and administrator security

Commuter login stays optional. Use backend-issued guest authorization/capabilities or an agreed anonymous authenticated session with ownership enforced server-side. Existing random local guest IDs are not credentials. Never authorize a query based only on a UUID supplied by the browser. Scope conversation reads/writes and subscriptions to the actual authorized participant. Do not allow anonymous public access to all support messages or personal queue records.

Future dashboard code belongs in **`src/apps/admin/`**; the folder is currently reserved and unchanged. Require administrator authentication and backend-controlled roles/RLS before exposing management, moderation, publication or message replies. A frontend `isAdmin` check is not access control. Keep service-role credentials and database passwords out of all `VITE_` variables and browser bundles. Only project URL and public frontend credential may be configured client-side, with appropriate RLS.

## Mock data inventory

| Fixture | Use |
| --- | --- |
| `data/locations.ts` | 12 illustrative places and legacy name mapping |
| `data/transportNetwork.ts` | Explicit directed demo graph, popular endpoint pairs, segment fares |
| `data/fares.ts` | Per-passenger sample fare tables and independent distance profiles |
| `data/demo.ts` | Legacy trip compatibility and baseline queue display cards |
| `data/roadwatchDemoData.ts` | Deterministic simulated advisories and development scenarios |

`services/demoCatalog.ts` is the only non-fixture import boundary for these modules. Historical `preview/sakaywise-v3-standalone.html` is not the React entry and must not replace the app.

## Local storage and migration

| Key | Payload |
| --- | --- |
| `sakaywise:settings:v1` | en/fil, light/dark/system, text size 90–130 |
| `sakaywise:introduction:v1` | versioned completed flag |
| `sakaywise:support:v1` | local guest session, drafts/conversations/messages |
| `sakaywise-v3:journeyLocations` | confirmed origin/destination with optional notes |
| `sakaywise-v3:recentLocations` | up to eight local selections |
| `sakaywise-v3:passenger` | passenger category |
| `sakaywise-v3:localReports` | up to fifteen local queue reports |
| `sakaywise-v3:savedTrips` | up to twelve legacy guides/itinerary snapshots |
| `sakaywise-v3:watchedTrip` | endpoint pair or legacy trip ID/null |
| `sakaywise-v3:alertPrefs` | existing three notification preferences |
| `sakaywise-v3:roadwatchPrefs` | advisory categories and saved-trip matching |

Validators reject malformed arrays, nested snapshots, enum values and timestamps before rendering. Settings reset never clears other stores. Blocked storage keeps in-session choices usable, warns about persistence and reports queue save failure. Storage is not encrypted; no automatic remote migration or cross-device synchronization exists. Add versioned migrations with tests when changing persisted models.

## Integration sequence

1. Agree stable IDs, provenance, effective dates, guest authorization and admin/RLS ownership. Keep demo mode runnable.
2. Implement validated read adapters for places/network/fares and one shared loading/error/retry snapshot owner. Feed the **existing** engine and all matching/detail consumers consistently. Test unknown/disconnected data and missing fare categories before enabling remote mode.
3. Integrate remote queue ingestion/aggregation with proper provenance, server timestamps and moderation; update matching and source labels without impersonating local reports.
4. Integrate verified advisory publication/read adapters; preserve expiry, no-alternative and no-queue-double-counting tests.
5. Implement private guest-scoped support and authenticated admin replies/subscriptions; update delivery labels only from real acknowledgments. Define migration/retention explicitly.
6. Add a geographic map only after verified coordinates/geometry/provider/attribution are available. The present expanded panel is a truthful unavailable state plus guide, not a tile-based map.
7. Test authorization denial/cross-guest isolation on the backend, then run frontend typecheck, tests, build and mobile regression. Add deploy configuration only as a separate reviewed task.
