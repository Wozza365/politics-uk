# Politics UK — Phase 0 (Foundations): completed

> Phase 0 is **done** (commit `3b0b51f`, pushed to `master`). This file is the
> historical record of what was built and how, kept out of
> [`PHASE_1_PLAN.md`](./PHASE_1_PLAN.md) so that document only carries
> still-relevant, forward-looking work. The authoritative design remains
> [`GAME_SPEC.md`](./GAME_SPEC.md).

## P0.1 — Project scaffold ✅

Vite + Vue 3 + TS + Pinia + Tailwind v4, `@/` alias, builds clean.

## P0.2 — Renderer abstraction + `SvgMapRenderer` ✅

`MapRenderer` interface (`src/map/MapRenderer.ts`) and an SVG backend
(`src/map/SvgMapRenderer.ts`, d3-geo + topojson-client) implemented and
wired into `MapView.vue` with hover/click events and a CSS faux-3D
treatment.

## P0.3 — Real Commons dataset ✅

Replaced the placeholder fixture with real, versioned, date-stamped data for
the `uk-2025-01-01` scenario. All six sub-tasks below are complete; the
scenario store (`src/stores/scenario.ts`) now loads this data, not the
placeholder.

### P0.3.1 — Fetch Commons boundaries ✅

- Verified the ONS Open Geography Portal feature service for *Westminster
  Parliamentary Constituencies (July 2024) Boundaries UK BGC* (ArcGIS item
  `b49f0eeb2ce540f394831ba3a514d86e`) — used BGC (20m generalised) over BFC
  for a smaller web payload.
- `scripts/data/fetch-commons-boundaries.mjs` fetches GeoJSON
  (`PCON24CD`→`geometryRef`, `PCON24NM`→`name`) and writes TopoJSON.
- Simplified with `mapshaper` (`npm run data:simplify-boundaries`, 10%
  simplify, `keep-shapes`): 16MB → 592KB.
- Verified all 650 features project to a non-empty SVG path with a unique
  GSS code (no duplicates, no orphans).
- **Output:** `src/data/scenarios/uk-2025-01-01/boundaries.commons.json`.

### P0.3.2 — Build Commons composition ✅

- `scripts/data/fetch-commons-composition.mjs` pulls all 650 current MPs
  from the UK Parliament Members API as of 2025-01-01.
- **Key correction vs. the naive approach:** a member's `latestParty` from
  the Members API reflects their party *today*, not on the as-of date — it
  would have shown the wrong party for anyone who's since defected, lost the
  whip, or returned to a party (e.g. Diane Abbott: Labour on 2025-01-01,
  Independent again from 2025-07-17). The script instead resolves party from
  each member's `partyAffiliations` history (`/Members/{id}/Biography`),
  picking the entry whose date range covers 2025-01-01.
- Majority/election date come from
  `/Location/Constituency/{id}/ElectionResults`, picking the most recent
  result on or before 2025-01-01 — robust to members who've since resigned
  (whose `/Members/{id}/LatestElectionResult` 404s once they leave the
  House).
- `voteShare` was deliberately **not** populated: it's optional on `Seat`
  and only available via a further per-result API call, not worth the load
  against an API that rate-limited us (Cloudflare 429, ~1hr cooldown) twice
  during development.
- Party names mapped to merged `PartyId` slugs per spec §4.3 (e.g. "Labour
  (Co-op)" → `labour`).
- **Output:** `src/data/scenarios/uk-2025-01-01/composition.commons.json` —
  650 regions, each with exactly one seat, cross-validated against
  boundaries in both directions (no orphans).
- **Final seat counts:** Labour 402, Conservative 121, Lib Dem 72,
  Independent 15, SNP 9, Sinn Féin 7, DUP 5, Reform UK 5, Plaid Cymru 4,
  Green 4, SDLP 2, Alliance 1, UUP 1, TUV 1, Speaker 1.

### P0.3.3 — Party master list ✅

- `scripts/data/build-parties.mjs` hand-authors 15 `Party` records (official
  colours, leadership as of 2025-01-01, founding year, `mergedFrom`) since
  these are stable, slow-changing facts — not pulled from the rate-limited
  Members API.
- `colours.onPrimary` is **computed**, not hand-picked: the script
  implements the WCAG 2.x relative-luminance contrast formula and asserts
  ≥4.5:1 against either black or white, throwing a build error otherwise.
  All 15 parties passed on the first try.
- **Output:** `src/data/scenarios/uk-2025-01-01/parties.json`.

### P0.3.4 — Assemble the scenario snapshot ✅

- `scripts/data/build-scenario.mjs` composes boundaries (kept separate),
  composition, and parties into `Scenario`.
- **Polling:** averaged from real GB-wide voting-intention polls fielded
  late Dec 2024 / early Jan 2025 (Deltapoll, Opinium, Freshwater Strategy —
  cross-checked via two independent Wikipedia fetches after the first
  fetch's numbers looked implausible). Labour 28%, Conservative 24%, Reform
  UK 22%, Lib Dem 12%, Green 8%, SNP 3% — sums to 97, the gap being NI
  parties/Plaid (not covered by GB-wide VI polls) and "don't know",
  deliberately left unallocated rather than guessed.
- **Finance:** pure estimates per the resolved spec decision (§13); every
  value carries `source: 'estimated'`.
- **Membership:** best-effort figures from public reporting (e.g. Reform
  UK's widely-reported overtaking of Conservative membership in late 2024);
  not independently verified, so also flagged as estimated.
- Full provenance/citations recorded in
  `src/data/scenarios/uk-2025-01-01/sources.json`.
- **Output:** `src/data/scenarios/uk-2025-01-01/scenario.json`.

### P0.3.5 — Validation + CI guard ✅

- `scripts/data/validate-scenario.mjs` (`npm run validate:data`) asserts:
  seat counts reconcile to known per-tier totals; every `Seat.party`
  resolves to a `Party`; every `Region.geometryRef` resolves to a boundary
  geometry and vice-versa; WCAG contrast holds for every party colour; no
  `NaN`/missing required fields; dates are valid ISO.
  - Supports `--placeholder` to validate the placeholder fixture instead
    of the real dataset.
- Running this against the placeholder fixture caught a real pre-existing
  bug — the placeholder's Conservative card failed WCAG contrast (3.82:1,
  white text on `#0087DC`) — fixed by switching to black text.
- No CI workflow added yet (optional in the original plan); easy to wire
  `npm run validate:data` into one later.

### P0.3.6 — Point the store at real data ✅

- `src/stores/scenario.ts` now imports `scenario.json` +
  `boundaries.commons.json` instead of the placeholder files (which remain
  in-repo for fixture/test use).
- Verified with a headless-browser screenshot: the real UK map renders with
  all 650 constituencies, coloured by holding party, zero console errors.
- `npm run build` and `npm run validate:data` both clean.

## Lords (spec §4.1, P1 stats-only)

Not yet started. Phase 1 wants Lords-by-party-group stats (no map needed —
it's not elected) but that data hasn't been gathered. Would need its own
small acquisition step before/alongside Phase 1's party panel work
(`src/components/PartyPanel.vue`, P1.7) if you want real Lords figures
rather than a "—" placeholder.

## Deferred to Phase 2+ (not part of Phase 0 or 1)

Holyrood (129 MSPs), Senedd (60 MS), NI Assembly (90 MLAs), London Assembly
(25 AMs), combined-authority mayors, PCCs, and all council tiers — see spec
§4.1. Each would need its own boundaries + composition acquisition,
following the same pattern as P0.3.1/P0.3.2 but against that tier's own ONS
boundary service and its own members/composition API.
