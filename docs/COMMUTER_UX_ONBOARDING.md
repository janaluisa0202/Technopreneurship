# Part 7 — Commuter refinement and introduction

The existing React app, route engine, services, data models, Settings provider and Support Center are retained. No dependencies were added, the reserved admin application was not edited, and no GitHub push was performed.

## First-time experience

The app opens a theme-aware welcome screen when `sakaywise:introduction:v1` has no valid `{version:1, completed:true}` record. Get Started opens four bilingual feature slides. Back, Next, clickable progress dots, Skip and Start Commuting work without login. Skipping or finishing saves completion and opens Routes. Returning sessions bypass the flow. Invalid or unavailable storage falls back safely; a failed completion write allows access for this session and explains that the introduction may reappear after reload.

Settings → View Introduction Again reopens the welcome and tour. Closing replay returns to Settings with the previous commuter tab preserved. Finishing replay goes to Routes. Replay does not reset language, appearance, text size, saved guides, addresses, reports, watch preferences or support history. Only an explicit selection in the introduction's language selector updates the existing language preference.

The flow uses the existing provider and translation keys. It supports Light/Dark/System and all five text scales. Content scrolls independently of the footer so Back, Next and Skip remain available with large text or a short viewport. Motion is brief and disabled by the existing reduced-motion rule. Focus is managed inside the introduction; the underlying app and navigation are inert until it closes.

## Routes and commute guide

The compact header retains branding, demo notice, saved count and Settings. Location cards have icons, labels, names, secondary addresses, edit indicators and separately labeled clear controls. Swap exchanges the **entire** confirmed selections, preserving address details and notes. It clears manual route selection and lets the existing request-key/cancellation logic compute the new endpoint pair. Unsupported reverse journeys produce no route; old fares or itineraries are not reused.

Location search retains confirmation, recent places and manual addresses. An additional From saved trips section resolves existing saved route endpoint IDs to known places. It reuses current/recent address details where available; saved guides do not invent saved-address details. Street numbers and notes remain optional. Recent/popular destination shortcuts remain available in a disclosure below the route results, keeping the most-used planning actions near the top.

The route preference controls are Fastest, Cheapest, Less Waiting and Fewest Transfers, mapped to the same engine priorities. The computed first-ranked route gets a yellow Recommended badge. A separate blue selection state identifies the commuter's choice. Alternatives show transport modes, original signboards, fare, total time, waiting, transfers and walking, with an expandable reason. Route cards are capped by the existing recommendation output; there are no hardcoded recommendation results. Commute steps and saving remain directly available on every card.

The route guide is an ordered vertical timeline generated from evaluated legs, with transport icons, boarding/alighting locations, original signboards, per-leg fares, durations, queue details and transfer time. Its final arrival item references the computed endpoint and adds no fabricated time or fare. Saved route snapshots use the same guide. Existing legacy guides remain readable.

RoadWatch remains in Para Alerts, with a compact summary between the map availability card and alternatives. Neutral no-match, unavailable/outdated, grounded-impact, alternative and no-alternative behavior is retained. Bottom navigation still has four tabs, consistent 44px-or-larger controls, a blue active state and an active indicator. The support control retains its reserved strip above navigation and opens the existing local demo chat; no second messaging implementation exists.

## Map limitation — deliberately explicit

Inspection found **no map component, map provider, coordinates, route geometry or OpenStreetMap integration** in this checkout. Part 7 adds compact map access and an expanded in-app panel that clearly displays the unavailable state and offers the computed commute guide. It does **not** provide an interactive geographic map, origin/boarding/transfer markers, map tile loading or step-to-coordinate focusing. No synthetic path, guessed coordinate, false attribution or network tile request was added.

The expanded panel follows the current selected route and passenger category and exposes Open commute steps without leaving the panel. Back restores Routes. To implement a real map later, supply verified coordinates/geometry and a configured provider with its attribution, loading/error/offline handling and coordinate-based focusing. This work should extend the existing route data instead of drawing lines inferred from stop names. Until then, the unavailable state is truthful in both languages and themes.

## Validation

- `npm run typecheck`: passed.
- `npm run build`: passed.
- 61 automated Node tests passed: existing location, routing, fare, queue, RoadWatch, settings and support coverage plus eight focused introduction/swap tests.
- Introduction navigation: welcome, all four slides, Next, Back, progress dots, Filipino switching, Start Commuting, Skip Introduction, reload persistence and Settings replay/close.
- First-run/skip tested on a fresh loopback origin without clearing existing commuter storage.
- Browser checks at 320×568, 375×667, 390×844, 430×932, 812×375 landscape, 390×420 shortened viewport and 1440×900 desktop. The final 49 checks cover welcome, four slides, Routes and the expanded map/guide in Filipino, Dark mode and 130% text, with no horizontal overflow, undersized interactive controls or clipped persistent footers.
- A separate 63-screen pass covered Routes, map panel, timeline sheet, location search, fares, queues, RoadWatch, support FAQ and messaging at the same sizes. It found an undersized swap button, corrected and rechecked in the final pass. Decorative welcome-art overflow was also corrected.
- English/light/default-size interactions verified safe swap, unsupported results, clearing locations, choosing saved endpoints, four ranking controls, manual route selection updating the map-panel guide, step navigation, passenger-specific FareGuard, queue-driven reranking, saved guides and support access.
- Real-device keyboard/safe-area behavior and native Capacitor integration still need physical-device testing. No live transport, official fare or GPS claims were introduced; support delivery remains local demo only.

Reproduce tests without installing anything:

```sh
npm run typecheck
npm run build
./node_modules/.bin/tsc --target ES2022 --module commonjs --moduleResolution node --skipLibCheck --outDir /private/tmp/sakaywise-part7-tests tests/*.test.ts
node --test /private/tmp/sakaywise-part7-tests/tests/*.test.js
```

## Exact Part 7 file inventory

Created:

- `src/apps/commuter/lib/onboarding.ts` — versioned completion storage and slide definitions.
- `src/apps/commuter/hooks/useIntroduction.ts` — first-run, replay and persistence-failure state.
- `src/apps/commuter/components/onboarding/Introduction.tsx` — welcome, decorative graphic and interactive four-slide flow.
- `src/apps/commuter/components/LocationSearchCard.tsx` — shared editable/clearable location card.
- `src/apps/commuter/components/RoutePreferenceSelector.tsx` — compact engine-priority controls.
- `src/apps/commuter/components/JourneyRouteCard.tsx` — recommended and compact alternative cards.
- `src/apps/commuter/components/RouteMapPreview.tsx` — truthful map availability and expanded-panel access.
- `src/apps/commuter/pages/MapOverview.tsx` — selected-journey summary and existing guide in the expanded panel.
- `tests/onboardingRefinement.test.ts` — eight introduction, persistence and swap tests.
- `docs/COMMUTER_UX_ONBOARDING.md` — behavior, map limitation, validation and inventory.

Modified:

- `src/apps/commuter/CommuterApp.tsx` — introduction/replay, swap, saved endpoint lookup and map-panel integration.
- `src/apps/commuter/components/MobileShell.tsx` — compact header/saved control; removed the decorative queue notification dot.
- `src/apps/commuter/components/LocationPicker.tsx` — saved-trip endpoint choices using existing address confirmation.
- `src/apps/commuter/components/RouteDetails.tsx` — ordered timeline and computed arrival item; locale-aware known-fare formatting.
- `src/apps/commuter/components/Icon.tsx` — edit, folded-map and expand icons in the existing icon system.
- `src/apps/commuter/pages/RoutesPage.tsx` — compact planning hierarchy, shared cards, priorities, map availability and alternatives.
- `src/apps/commuter/pages/SettingsPage.tsx` — replay introduction entry.
- `src/apps/commuter/lib/locations.ts` — pure whole-selection swap helper.
- `src/shared/i18n/en.ts` — typed introduction and refined-interface messages.
- `src/shared/i18n/fil.ts` — matching Filipino translations.
- `src/styles.css` — new screen/component layouts, timeline, compact navigation/header and responsive text handling.
