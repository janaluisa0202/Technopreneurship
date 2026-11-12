# Backend architecture assessment (Phase 1)

Written before any backend code was added, from `main` at `baa1681`. The repository is the source of truth; where the master prompt and the code disagree, this document follows the code.

## What exists

| Item | Finding |
| --- | --- |
| Stack | React 19.2, TypeScript ~5.9, Vite 7.2, Node 22. Runtime deps: `react`, `react-dom` only. |
| Checks | `npm run typecheck`, `npm test` (72 Node tests, all passing at baseline), `npm run build`. No ESLint/lint script. CI runs the three checks. |
| Backend | None. No Supabase project, client, migrations, `supabase/` folder or Edge Functions. `.env.example` has commented placeholders only. |
| Admin | `src/apps/admin/README.md` only — reserved folder. |
| Handoff | `docs/BACKEND_HANDOFF.md` defines the contracts the backend must satisfy. This work follows it. |

### Existing data seams

| Seam | File | Notes |
| --- | --- | --- |
| Service contracts | `services/contracts.ts` | `DataResult<T>` with `provenance`, `TransportNetworkService`, `RouteInformationService`, `FareMatrixService`, `QueueReportService`, `CommuterDataServices`. |
| Demo boundary | `services/demoCatalog.ts` | Only import point for fixtures — but `routeEngine`, `advisoryImpact`, `roadwatchService`, `fares`, `locations`, `roadwatchPersonalization`, `RoutesPage`, `AlertsPage`, `QueuesPage`, `Sheets`, `RoadWatchDetails`, `CommuterApp` all import from it synchronously. |
| Route engine | `lib/routeEngine.ts` | Sole planner. `analyzeRouteRecommendations(request, reports, now, network, advisories)` already accepts an explicit network. Bounded directed-graph search. **Must not be duplicated server-side.** |
| Fares | `lib/fares.ts` | Per-segment `FareTable` (regular/student/senior/pwd). Missing = unavailable. Separate distance calculator profiles. |
| Queues | `lib/queues.ts` | Applies only `isLocal` reports < 30 min old; otherwise segment demo baseline. |
| RoadWatch | `hooks/useRoadWatch.ts`, `lib/roadwatchService.ts`, `lib/advisoryImpact.ts` | Provider interface `RoadWatchProvider.load()` returning `unknown[]`; client validates. Impacts by explicit ID only. |
| Support | `types/support.ts` `SupportService`, `lib/supportService.ts` (local), `hooks/useSupportCenter.ts` | Has `mode: 'local-demo' \| 'remote'`; remote adapter anticipated. |
| Settings | `src/shared/settings` | LocalStorage only; no backend needed. |

### Mock data inventory

`data/locations.ts` (12 places, 6 routable), `data/transportNetwork.ts` (30 nodes, 39 directed segments, 6 popular pairs), `data/fares.ts` (16 per-passenger tables + 3 distance profiles), `data/demo.ts` (legacy trips, 4 baseline queue cards), `data/roadwatchDemoData.ts` (8 simulated advisories + 3 scenarios). All explicitly fictional.

### LocalStorage keys

`sakaywise:settings:v1`, `sakaywise:introduction:v1`, `sakaywise:support:v1`, and `sakaywise-v3:{journeyLocations, recentLocations, passenger, localReports, savedTrips, watchedTrip, alertPrefs, roadwatchPrefs}`. None are migrated or uploaded by this work.

## Required database entities (mapped to real frontend types)

| Frontend type | Table(s) | Key decision |
| --- | --- | --- |
| `Place` | `transport_places` | Text IDs identical to fixture IDs (`ust-frassati`). |
| `TransportNode` | `transport_stops` | Place endpoints are stops with `place_id` (the engine starts at node id = place id). |
| `TransportSegment.serviceId` | `transport_services` | The prompt's "transport_routes". Named *services* because "route" in the frontend means a computed itinerary (`RouteItinerary.id = segment ids joined by \|`). |
| `TransportSegment` | `transport_segments` | Directed `from_stop_id → to_stop_id`; no reverse inferred. Queue baseline columns live here. |
| `segment.queue.terminal` | `queue_terminals` | Terminals were free-text strings; now stable slugs with display names. |
| `popularJourneys` | `popular_journeys` | |
| `FareTable`, `DistanceFareProfile` | `fare_matrices`, `fare_rules` | Matrix carries source, effective dates, verification status. Rules are per segment *or* per distance band. |
| `QueueReport` | `queue_reports` + `get_queue_estimates()` | Raw reports private; public sees aggregates only. |
| `RoadAdvisory` | `road_advisories`, `road_advisory_impacts` | Impacts are explicit typed FKs to segment/stop/service, or an itinerary ID. |
| `SupportConversation/Message` | `support_conversations`, `support_messages` | Owned by a Supabase anonymous (or real) user id. |
| — | `admin_role_assignments`, `admin_audit_log` | Server-enforced roles. |
| `SavedTrip`, settings | `commuter_saved_trips`, `commuter_preferences` | Prepared for non-anonymous accounts only; not wired (accounts not enabled). |

Prompt tables intentionally **not** created: `transport_route_stops` (ordered stops are already encoded by directed segments; nothing consumes them) and a materialised `queue_estimates` table (estimates are computed on read so they can never be stale).

## Missing backend functionality (now in scope)

Persistent network/fare data with provenance; queue ingestion with server timestamps, idempotency, rate limiting, moderation, expiry and aggregation; advisory publication with source attribution; guest-scoped support with admin replies and realtime; admin roles; demo/live switch; seed; tests.

## Integration risks and mitigations

1. **Synchronous fixture imports everywhere.** Mitigation: a single *active catalog* registry (`services/catalog.ts`). Demo mode = the fixtures (unchanged behaviour). Live mode = a validated snapshot loaded **before** `CommuterApp` mounts, so every existing synchronous call site sees the live catalog without being rewritten.
2. **Place identity validation** rejects non-demo places on reload. Mitigation: additive `Place.source: 'remote'`; validator checks against the active catalog.
3. **Queue trust model.** `latestQueueReport` only honours `isLocal`. Mitigation: additive `QueueReport.source = 'community-aggregate'`, honoured explicitly; remote data is never tagged `isLocal`.
4. **Silent demo substitution.** Mitigation: explicit `VITE_SAKAYWISE_DATA_MODE=demo|live`. Live mode with missing config or a failed load shows an error + retry, never fixtures.
5. **Guest authorization.** The local guest UUID is not a credential. Mitigation: Supabase Anonymous Sign-Ins → real JWT; RLS on `auth.uid()`; created lazily only when a guest submits something.
6. **Truthful labels.** Support UI currently hard-codes "saved on this device". Mitigation: labels switch on `service.mode`; "Sent" only after the insert returns; no presence, no fabricated replies.
7. **Concurrent frontend work.** Mitigation: shared-type changes are additive and listed in `docs/BACKEND_INTEGRATION.md`; UI changes are limited to labels and a loading gate.
