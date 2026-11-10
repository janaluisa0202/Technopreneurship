# Smart route recommendations

The existing searchable locations and address forms remain the source of confirmed place IDs. Changing either ID, passenger category, preference, or relevant queue reports starts a new local computation. The pending message has no artificial delay. Unsupported IDs and disconnected directions return no routes while retaining the addresses.

## Network and ranking

`data/transportNetwork.ts` defines a directed graph of entrances, boarding stops, platforms, walking links, and individual vehicle rides. All connections, service names, boarding instructions, fares, and durations are fictional demo examples. No reverse edge is inferred. The six published sample pairs each have at least three itineraries; other journeys are available only if their explicit segments connect.

`lib/routeEngine.ts` enumerates connected simple paths within bounds: 10 segments, 3 rides, 10,000 expansions, and 256 completed candidates. It prevents revisiting nodes and re-entering a previously left geographic area. Equivalent vehicle sequences are deduplicated using their shortest mapped walking approach. The best three complete journeys are returned for the chosen preference, with deterministic tie-breaking by total duration and route ID.

- Fastest: walking + riding + queue + other boarding wait + transfer dwell.
- Cheapest: sum of the selected passenger's explicitly defined leg fares; incomplete fare totals sort after complete totals.
- Less waiting: queue + other boarding wait.
- Fewest transfers: vehicle boardings minus one, with total duration breaking ties.

Every ride edge represents a new boarding with its fare charged once. Walking links contain no fare or queue. Transfer dwell applies only after an earlier ride; the separate walking transfer link is counted as walking, not again as transfer dwell.

## QueueSense

`lib/queues.ts` applies a local report only to a matching terminal and, when supplied, segment ID. Each segment defines sample wait minutes for low, moderate, and high conditions. Reports expire after 30 minutes; missing, future, invalid, or untimestamped reports use the segment's labeled demo baseline. The hook schedules a recalculation at the next report expiry. A changed winning route produces an in-app explanation. These reports are never described as verified or live.

## Fares and saved guides

`data/fares.ts` contains explicit per-passenger sample entries and separate distance-calculator profiles. `lib/fares.ts` is shared by route evaluation, Fare Matrix/FareGuard, and saved-guide repricing. There is no universal discount. A missing entry produces an unavailable total and disables the route's FareGuard comparison; the known subtotal remains identified as incomplete.

New saved guides contain the evaluated route and its sample fare tables, so their complete timeline can be reopened and repriced for another category. Queue and time estimates are identified as saved snapshots. Older saved guides remain readable using their original saved amount and instructions. They are not assigned invented leg-level fare breakdowns. Legacy route-watch IDs are also retained.

## Integration boundaries

Place identity, address details, directed transport segments, fare entries, queue observations, and evaluated itineraries have separate types. A future provider can supply verified nodes/segments, maintained fares, and timestamped queue observations without changing the address forms or recommendation cards. There are no mapping credentials, GPS requests, remote transit services, or backend assumptions in this implementation.

## Validation

Run the normal app checks:

```sh
npm run typecheck
npm run build
```

The focused tests use existing TypeScript and Node dependencies:

```sh
./node_modules/.bin/tsc --target ES2022 --module commonjs --moduleResolution node --skipLibCheck --outDir /private/tmp/sakaywise-routing-tests tests/locations.test.ts tests/routeEngine.test.ts
node --test /private/tmp/sakaywise-routing-tests/tests/*.test.js
```

The routing tests cover directed connectivity, ranking, exact metric accounting, unrelated/scoped queue reports, expiry, missing fares, passenger-dependent ranking, deduplication, geographic cycles, unsupported places/directions, invalid edges, and saved snapshots. The location tests continue to cover the existing search and address model.

## Files changed

Added:

- `src/apps/commuter/data/transportNetwork.ts`
- `src/apps/commuter/data/fares.ts`
- `src/apps/commuter/types/route.ts`
- `src/apps/commuter/lib/routeEngine.ts`
- `src/apps/commuter/lib/fares.ts`
- `src/apps/commuter/lib/queues.ts`
- `src/apps/commuter/hooks/useRouteRecommendations.ts`
- `src/apps/commuter/components/RouteDetails.tsx`
- `tests/routeEngine.test.ts`
- `docs/SMART_ROUTE_RECOMMENDATIONS.md`

Updated:

- `src/apps/commuter/CommuterApp.tsx`
- `src/apps/commuter/types.ts`
- `src/apps/commuter/lib/commute.ts`
- `src/apps/commuter/hooks/useModalFocus.ts`
- `src/apps/commuter/components/Icon.tsx`
- `src/apps/commuter/components/Sheets.tsx`
- `src/apps/commuter/pages/RoutesPage.tsx`
- `src/apps/commuter/pages/FareMatrixPage.tsx`
- `src/apps/commuter/pages/QueuesPage.tsx`
- `src/apps/commuter/pages/AlertsPage.tsx`
- `src/styles.css`

No dependencies, admin files, hosting settings, or external services were changed.
