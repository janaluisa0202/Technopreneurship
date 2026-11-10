# Current implementation status

See [FRONTEND_AUDIT.md](FRONTEND_AUDIT.md) for the final audit and [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md) for actual integration contracts and limitations.

| Area | Implemented | Remaining |
| --- | --- | --- |
| Welcome/introduction | Four bilingual steps, skip, progress, persistence and Settings replay | Physical-device usability checks |
| Location search | Local searchable places, manual addresses, notes, recents/saved endpoints, clear/swap | Real provider and verified place identity migration |
| Routes | One bounded graph engine, four priorities, alternatives, passenger fares, timeline | Verified/versioned network and scalable metropolitan planning |
| Commute map | Unavailable-state preview/expanded guide | Geographic map, coordinates, geometry, tiles, attribution and marker focusing |
| FareGuard | Selected-journey and distance-sample comparison, missing fares unavailable | Verified effective tariffs and eligibility data |
| QueueSense | Local unverified reports, filtering, freshness and reranking | Remote ingestion, moderation, provenance and aggregation |
| RoadWatch | Search/filter/sort, provenance/status/freshness, ID impacts and alternatives | Verified provider and production publication workflow |
| Para Alerts | Local watches/preferences and saved-trip matching | Real notification subscriptions/push |
| Saved guides | Local snapshots and readable legacy guides | Explicit server migration/sync, retention and offline install/cache |
| Personalization | English/Filipino, Light/Dark/System, 90–130% text, persistence | Real-device accessibility review |
| Support | FAQ, optional details, validation and device-only draft/history | Private backend conversations/admin replies and real delivery events |
| Data layer | Central demo catalog, typed contracts, async reference adapters, wired local queue adapter | Coordinated remote snapshot loader and provider adapters |
| Validation | Typecheck, Node tests, Vite production build, CI workflow | Actual GitHub CI run after repository creation; no lint configured |
| Authentication/admin | Reserved folder only | Backend guest authorization, administrator Auth/roles/RLS and dashboard |

This is a web prototype, not an Android APK/iOS IPA. No backend or service worker is configured. The final audit preserves demo functionality and does not implement another developer's backend assignment.
