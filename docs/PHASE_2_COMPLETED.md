# Politics UK — Phase 2: completed so far

> Phase 2 is **in progress** — this file is the record of what's already
> built and how, kept out of [`PHASE_2_PLAN.md`](./PHASE_2_PLAN.md) so that
> document only carries still-relevant, forward-looking work. The
> authoritative design remains [`GAME_SPEC.md`](./GAME_SPEC.md). See
> `PHASE_2_PLAN.md` §A for what's still open and the current critical path.

## P2.5 — Hex-map renderer ✅

- Added `HexBoundarySet` as a sibling to the TopoJSON-backed geographic boundary shape in
  `src/map/MapRenderer.ts`. The hex layout is deliberately schematic data (fixed `x`/`y` centres
  keyed by `geometryRef`), not a forced geographic topology.
- Added `boundaries.commons.hex.json` from the UK WPC hex constitcode v5 June 2024 source:
  650 GSS-coded Westminster constituencies, all matched to the existing Commons `geometryRef`s.
  `sources.json` records the download URL and transformation.
- Added `HexMapRenderer`, implementing the same `MapRenderer` contract as `SvgMapRenderer`:
  `mount`, `render`, `setEvents`, `resize`, `unmount`, region bounds/size extent, and background
  blur. It draws equal-size pointy hexes coloured from the existing `RegionState`, with the same
  hover/click/focus event path used by `MapView.vue`.
- The bottom view switcher now includes a small Westminster renderer toggle (`Geo` / `Hex`).
  Regional and council maps stay on the SVG geographic renderer; Westminster can switch without
  changing the map consumer's tooltip, zoom, pan, or focus logic.
- **Acceptance:** browser verification on the game screen showed geographic Westminster rendering
  SVG paths, then Hex rendering exactly 650 SVG polygons with party fills. Clicking a hex lifted one
  region and dimmed the other 649 through the existing focus code. `npm.cmd run build` and
  `npm.cmd test` (66 tests) pass.

## P2.4 — Council tiers (the long tail) ✅

- The bottom view switcher now exposes **County** and **Local** directly alongside Westminster and
  Regional. County stays separate because it overlaps districts; Local merges
  district/borough, unitary, metropolitan, London, Scottish, Welsh, and NI councils after verifying
  those tiers share zero geometry refs. Unrepresented areas may stay neutral grey per
  `GAME_SPEC.md` ?9.6.
- `scripts/data/fetch-council-composition.mjs` downloads Open Council Data UK's public 2024
  councillor archive plus authority-type/control pages, then joins each authority to real ONS
  December 2024 boundary geometry. The 2024 archive is intentional because the scenario starts on
  2025-01-01 and Open Council Data's annual CSVs are post-May snapshots. Output:
  `composition.councils.json` with 381 principal-authority regions and 19,186 councillor seats,
  split into `council:<level>` tiers; parish/town/community councils remain excluded.
- `boundaries.councils.json` now contains real ONS TopoJSON geography: the County view uses
  Counties and Unitary Authorities December 2024 BGC boundaries, and the Local view uses
  Local Authority Districts December 2024 BGC boundaries. Each object includes grey filler
  geographies for places not represented by the selected level, so the Councils map remains an
  actual UK map without merging overlapping county/district seats. The committed topology is
  simplified to 10% with mapshaper `keep-shapes`.
- `scripts/data/fetch-pcc-composition.mjs` adds Police & Crime Commissioners as a stats-only `pcc`
  tier: Conservative 19, Labour 17, Plaid Cymru 1 for the 37 PCC-only areas elected on 2024-05-02.
  Metro mayors with PCC powers stay in the existing P2.3 mayoralties data rather than being
  double-counted here.
- `build-scenario.mjs` folds `pcc` and all `council:<level>` tiers into `scenario.json`.
  `validate-scenario.mjs` checks the PCC total and rejects council IDs that appear in more than
  one council tier, which enforces the no-overlapping-seat invariant at data-build time.
- `MapView.vue` can render the Councils view through the County/Local tabs and switch its boundary
  object by active council level. Council hover cards show control labels instead of MP/member details. `HemicycleView.vue`
  now follows the active view and scales large tiers to 1 dot = 10/100 seats as needed.
- Clicking a focused council now drills into that council's real ward/division geography:
  Local councils use ONS Wards December 2024 BGC, County councils use ONS County Electoral
  Divisions May 2024 BGC, and Northern Ireland councils use OSNI District Electoral Areas 2012.
  `composition.council_wards.json` and `boundaries.council_wards.json` hold 9,375 ward/division
  regions grouped one TopoJSON object per council, with strict name matching in the generator.
- `PartyPanel.vue`'s "Controlled councils" card now reads real per-council `control.party` metadata
  rather than counting raw councillor seats.
- `sources.json` records Open Council Data UK and House of Commons Library provenance. `package.json`
  gained `data:fetch-councils` and `data:fetch-pcc-composition`; `npm test` excludes local
  `.claude/**` helper worktrees so the repo test command ignores unrelated nested checkouts.
- **Acceptance:** County and Local map tabs exist with real principal-authority composition data,
  non-overlapping granularities, real controlled-councils counts, and PCC stats; `npm run
  validate:data`, `npm run test` (66 tests), and `npm run build` clean. The production build emits a
  Vite chunk-size warning because the council dataset is large; this is a performance follow-up,
  not a correctness failure.

## P2.3 — Mayoralty: London, combined-authority, and other local mayors ✅

- **Design call (open question from `PHASE_2_PLAN.md`, now resolved):** mayors are a stats list,
  not a map overlay. None of the ~24 non-London areas (combined authorities especially) have
  boundary geometry anywhere in this dataset, and building one just to host ~25 disjoint single
  seats would be exactly the over-building the task warned against — so `Mayoralty` carries a
  `regionRef` slug for a future hover-link, but nothing resolves it against `geometryRef` today.
- New `Mayoralty` type (`src/types/mayoralty.ts`): `id`, `name` (office title), `kind`
  (`'london' | 'combined_authority' | 'local'`), `regionRef`, `party`, `memberName`, `electedAt`.
  Lives as `Scenario.mayoralties: Mayoralty[]`, a sibling of `tiers`, not inside it — these aren't
  `Region`/`Seat` shaped (no internal composition, just one current holder).
- `scripts/data/fetch-mayors.mjs` (new) hand-curates all 25 as-of-2025-01-01 holders (no single
  bulk source exists): the London mayoralty, all 11 combined-authority/CCA mayors elected/in office
  by that date (the 6 established 2017-cycle authorities plus North East/East Midlands/York and
  North Yorkshire, all first elected 2024-05-02; Greater Lincolnshire and Hull and East Yorkshire
  came later in May 2025 and are correctly excluded), and the 13 single-council directly-elected
  local mayors still in post (Bristol/Liverpool/Torbay/Copeland/Hartlepool/Stoke-on-Trent had all
  abolished the role before this date and are excluded). Several holders changed close to the
  scenario date and needed explicit as-of-date checking rather than just "who holds it now":
  Cambridgeshire and Peterborough was still Nik Johnson (Paul Bristow won later, 2025-05-01), West
  of England was still Dan Norris (Helen Godwin also won 2025-05-01), Hackney was Caroline Woodley
  (won a 2023-11-09 by-election after Philip Glanville's resignation, not Glanville), and Lewisham
  was Brenda Dacres (won a 2024-03-07 by-election after Damien Egan resigned to fight a
  parliamentary seat). One new party, Aspire (Lutfur Rahman's Tower Hamlets vehicle), added to
  `parties.json`/`party-slugs.mjs`.
- `build-scenario.mjs` reads `mayoralties.json` and adds it to the assembled `Scenario` unchanged
  (no merging/derivation needed, unlike the tiers' boundary+composition join).
- `validate-scenario.mjs` gained a mayoralties check (duplicate ids, unknown party references,
  invalid `electedAt` dates) — not folded into the existing per-tier loop since mayoralties aren't
  a tier and have no boundary geometry to cross-check.
- `src/stores/scenario.ts` gained a `mayoraltyCountByParty` getter (counts held per `PartyId`).
  `PartyPanel.vue` gained a "Mayoralties" stat card (in the same expanded grid as Lords/Leader
  approval/Days since election) showing the selected party's count — a small addition to the
  existing panel rather than a new view, per the task's "not a new full-screen view" steer.
- **Acceptance:** 25 mayoralties exist in the scenario and are surfaced as a real count in the
  party panel; `npm run validate:data`, `npm run build`, and `npm run test` (66 tests) all clean.

## P2.1 — Regional view: Holyrood, Senedd, NI Assembly, London Assembly ✅

- One combined **Regional** view, not four separate ones: `src/stores/ui.ts`'s `GameView` union
  collapsed `holyrood`/`senedd`/`ni-assembly`/`london` into a single `'regional'` member;
  `ViewSwitcher.vue` now shows Westminster / Regional / County / Local.
  The four bodies stay separate `TierId`s in `Scenario.tiers` underneath — only the view is merged.
- Real boundary + composition data fetched for all four bodies as of 2025-01-01: Holyrood (73
  constituencies + 8 list regions, 129 MSPs), Senedd (40 constituencies + 5 list regions, 60 MS,
  the pre-2026 system), NI Assembly (18 Westminster-coincident STV constituencies, 90 MLAs —
  `scripts/data/derive-ni-assembly-boundaries.mjs` reuses `boundaries.commons.json` rather than
  re-fetching), London Assembly (14 constituencies + 1 London-wide list region, 25 AMs). New
  parties encountered (Alba Party, People Before Profit) added to `parties.json`/`party-slugs.mjs`.
- **Holyrood/Senedd/London Assembly's list-seat regions have no boundary geometry of their own** —
  only their 73/40/14 constituencies do (`fetch-holyrood-boundaries.mjs`'s header comment records
  why: the map only needs constituency-level shapes). Those list regions still exist in
  `composition.<tier>.json` for seat-count/stats purposes; they just never get a `geometryRef` hit
  in `boundaries.regional.json`, so they're invisible on the map by design, not by omission.
- `scripts/data/build-regional-boundaries.mjs` (new) merges the four tiers' boundary topologies
  into one `boundaries.regional.json`, plus England-outside-London filler from
  `boundaries.commons.json`. There's no official ONS lookup from the 2024 Westminster boundary
  review to "is this constituency in London" yet, so
  `scripts/data/fetch-london-constituencies.mjs` (new) derives it geometrically: point-in-polygon
  test of each constituency's ONS-supplied centroid against the official London region polygon
  (ArcGIS item `d471e7de92fc43aba1050dcec35d1fb3`) — 75 matches, the well-known figure for Greater
  London's post-2023-review seat count.
- `src/stores/scenario.ts` gained `regionalBoundaries` and a `regionalRegionsByGeometryRef` getter
  flattening all four tiers keyed by `geometryRef`. `MapView.vue` branches on
  `useUiStore().activeView`: `'regional'` colours each constituency by its seat-holder's party and
  marks every filler region `disabled: true` (greyed out, non-interactive, no tooltip, per spec
  §9.1) via the existing `RegionDisplayState.disabled` field.
- **Hemicycle stays Commons-only** (deliberately out of scope) — four disjoint legislatures don't
  compose into one hemicycle the way Westminster's single chamber does.
- Fixed two latent bugs surfaced while building this: `validate-scenario.mjs`'s seat-count check
  compared region *count* to the known seat total, which only happened to work for Commons'
  one-seat-per-region shape — it now sums `seats.length` across regions. `build-parties.mjs`'s
  `PARTIES_SOURCE` never carried the `history` field at all (it was hand-patched into the output
  JSON once, in a commit that didn't touch the generator), so the routine act of regenerating
  `parties.json` to add the two new parties silently dropped every existing party's history;
  `history` is now part of `PARTIES_SOURCE` so regeneration is safe going forward.
- **Acceptance:** the view switcher flips between Westminster and Regional; Regional shows real
  Holyrood/Senedd/NI Assembly/London Assembly boundaries and composition simultaneously, each
  coloured by current seat-holder's party, with England-outside-London fully greyed out and
  non-interactive; `npm run validate:data`, `npm run build`, and `npm run test` (66 tests) clean.

## P2.0 — Polling-driven seat projection at the GE ✅

- `src/sim/projection.ts` (new) — `projectSeatsByParty(regions, startPolling, currentPolling)`: a
  pure, deterministic uniform-national-swing projection. `nationalSwing()` computes each party's
  polling movement since the scenario's day-one snapshot; every seat's last real `results`
  breakdown (P1.14's `CandidateResult[]`) is shifted by its party's swing (floored at 0%), and
  whichever candidate now has the highest projected share wins the seat. A seat with no `results`
  data just keeps its recorded incumbent rather than guessing. Unit-tested in
  `src/sim/projection.spec.ts` the same way `src/sim/poll.ts` is.
- `src/stores/game.ts` — added `projectedCommonsSeatsByParty`/`projectedPlayerSeatCount` getters
  built on `projectSeatsByParty`, and `checkElectionResult()` now judges the win/lose threshold
  against the projection instead of the unchanged starting `commonsSeatsByParty`/`playerSeatCount`
  (those two getters are kept as-is — still useful as the "starting position" to compare against).
- **The GE is the headline moment, not a finale.** Added `game.continuePlaying()` (resumes the
  clock; deliberately leaves `result` set so `checkElectionResult`'s existing guard doesn't
  re-fire it) and wired it into `ResultScreen.vue` as a "Continue playing" button alongside the
  existing "Play again" restart — `ResultScreen.vue` now shows the projected seat count and lets
  the player drop straight back into live play with the same party/date/polling rather than
  ending the run.
- **Scoped deliberately narrow:** `ResultScreen.vue`/`game.result` remain GE-specific. Other
  regular elections (devolved parliaments, councils, mayors/PCCs, by-elections) are intentionally
  **not** routed through this win/lose screen — none of their composition data exists yet
  (P2.1/P2.3/P2.4 were still open when P2.0 landed) — and per the doc's own no-speculative-building rule, a generic
  multi-election-result system wasn't built ahead of that data landing. `PHASE_2_PLAN.md`'s P2.0
  entry and P2.8 carry forward notes for whoever picks those up: non-GE results should be a
  non-blocking "here's what happened" notice, not a second win/lose gate.
- **Known follow-on, not fixed here:** once the GE date passes, `GameClock.vue`'s countdown has
  nothing left to count toward and just shows "General Election day" indefinitely — deciding what
  the clock counts down to next is tied to P2.8's "list all upcoming elections" note, so it's left
  there rather than patched in isolation.
- Covered by `src/stores/game.spec.ts` (`checkElectionResult` judges the projection not the static
  count; doesn't re-evaluate once a result is recorded; `continuePlaying` resumes the clock without
  clearing the result) and `src/sim/projection.spec.ts` (swing computation; incumbent-keeps-seat
  with no swing; seat flips once swing overtakes the local gap; sums across many seats; falls back
  to the incumbent with no `results` data; never projects a negative vote share).
- **Acceptance:** the GE result reflects in-game polling movement, not just the scenario's starting
  seats, and offers a real "continue playing" path back into the live game; `npm run build` and
  `npm run test` clean.
