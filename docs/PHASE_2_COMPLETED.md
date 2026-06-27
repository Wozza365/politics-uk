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

## P2.9 — Deeper Democracy-3-style menus & charts (expanded party panel) ✅

- `src/stores/game.ts` — added a live `finance`/`membership` overlay (mirroring the existing
  `polling` pattern relative to `scenario.scenario`'s static JSON, which is `markRaw`'d and so
  can't be mutated reactively), a `leverCooldowns: Record<string, ISODate>` map keyed by
  `${partyId}:${leverId}`, a `leverCooldownRemaining(leverId)` getter-as-function, and two actions:
  `runFundraisingAppeal()` (raises `finance[partyId].estimatedCashOnHand`, posts a feed entry,
  starts a cooldown) and `runSocialMediaCampaign()` (grows `membership[partyId]`, pushes a
  `PollingImpact` onto `pendingPollImpacts` with `source: 'lever:socialMedia'` — routed through the
  existing seam rather than mutating `polling` directly — and starts its own cooldown). Both use
  the seeded `mulberry32` RNG (`seededUniform`/`seededVariance`), never `Math.random()`.
- `src/composables/usePartyLevers.ts` (new) — thin composable exposing each lever's remaining
  cooldown (in days) and its trigger action, keeping `PartyPanel.vue` free of store plumbing.
- `src/composables/usePartyStats.ts` — `finance`/`membership` computeds now read the live
  `game.finance`/`game.membership` overlay instead of the static scenario snapshot (trend-arrow
  `previousFinance`/`previousMembership` deltas are left reading `Party.history`, unaffected).
- `src/components/LeverCard.vue` (new) — small presentational card (label, description, action
  button, cooldown state) shared by both levers, per the project's "repeated card markup → small
  component" convention.
- `src/components/PollingHistoryChart.vue` (new) — `vue-echarts`/`echarts` (added as dependencies)
  line chart over `game.pollingHistory`, one series per party that has ever registered a non-zero
  poll share (so a long tail of zero-data fringe parties doesn't clutter the legend), with the
  selected party's line highlighted. Tree-shaken imports (`LineChart`, `GridComponent`,
  `TooltipComponent`, `CanvasRenderer`) per `echarts/core`'s `use()` registration pattern.
  - **Gotcha hit and fixed:** `vue-echarts` injects its own global `<style>x-vue-echarts{height:100%}</style>`
    into `document.head` at runtime, unlayered. CSS cascade layers make unlayered rules always beat
    layered ones (Tailwind v4 generates all utilities inside `@layer utilities`), so a height
    utility class placed directly on `<v-chart>` was always losing to that injected rule, and
    `height:100%` against an auto-height parent collapsed to 0. Fixed by giving a wrapping `<div>`
    the explicit `h-[160px] w-full` instead of putting it on `<v-chart>` itself — a selector
    vue-echarts' injected CSS doesn't target — so the percentage height it sets has something
    concrete to resolve against.
- `src/components/PartyPanel.vue` — the expanded body's previous "Expanded party controls will live
  here later" placeholder (from P1.7) is now real: a "Polling history" `PartyStatCard` holding the
  new chart, and two `LeverCard`s (Fundraising / Social media) wired to `usePartyLevers`. The
  existing direct `pauseClock()`/`resumeClock()` toggle on expand/collapse is left as-is — P2.8
  (the shared menu-pause flag this task's contract says to reuse if it landed first) is still
  `🔲 TODO`.
- **Scoped deliberately narrow:** only fundraising and social media are real, playable levers, per
  the acceptance criteria's "at least" — staffing, policy, campaigning and leadership levers from
  `GAME_SPEC.md` §9.3 are left for later.
- Covered by 4 new tests in `src/stores/game.spec.ts` (`useGameStore player levers — P2.9`):
  fundraising raises finance and starts a cooldown; is a no-op while on cooldown; social media
  grows membership and queues exactly one `pendingPollImpacts` entry through the existing seam;
  cooldowns count down correctly as `game.date` advances. Manually verified end-to-end in
  `npm run dev` via Playwright (click through party select → start → expand panel → trigger both
  levers → confirm finance/membership/feed/cooldown UI and the now-visibly-sized polling chart).
- **Acceptance:** fundraising and social media are real, playable levers that move
  finance/membership/polling through the existing sim contract; the clock pauses while the panel
  is expanded; `npm run build` and the test suite are clean.

## P2.8 — Expandable clock / by-elections panel ✅

- `src/types/election.ts` (new) — `Contest` (a generated by-election/vacancy), `ContestTier`
  (`'commons' | 'council'`), `ContestActionId`, `ContestActionDef`. `councilLevel` is kept as a
  plain `'county' | 'local'` union rather than importing `CouncilLevelId` from `stores/scenario.ts`,
  since `sim/` never imports `stores/`.
- `src/sim/byElections.ts` (new) — deterministic runtime scheduler, seeded per-day via the existing
  `mulberry32` RNG (date + tier as the seed), using inverse-CDF Poisson sampling rather than a fixed
  per-day probability so the *count* of contests on a busy day is itself randomised believably.
  Parliamentary by-elections are tuned to roughly 10/year; council by-elections to a few hundred/year
  across wards. Exposes `rollByElectionsForDay()`, `resolveContestAction()`,
  `CONTEST_ACTIONS_BY_TIER` (small per-tier action sets — `ignore`/`local_push`/`nationalise_the_race`
  for commons; `ignore`/`token_effort`/`local_push` for council), and `startOfIsoWeek()` (for the
  weekly council grouping). Covered by 9 unit tests.
- `src/stores/game.ts` — new `contests: Contest[]` state; `tickDay()` now also calls
  `rollByElections()`, which pushes generated contests, posts one feed entry per commons contest, and
  upserts a single `byelection:council:week:<isoWeek>` feed entry (with a running count in its
  headline) per ISO week any council contests land in, rather than spamming one entry per ward.
  `actionContest(contestId, actionId)` resolves a contest exactly once, queues its `PollingImpact`
  through the existing `pendingPollImpacts` seam, and (for commons contests) updates the matching
  feed entry's `actionTaken`/`effect`/`actions` the same way `resolveFeedAction` does.
- `src/stores/ui.ts` — generalised the menu-pause mechanism the P2.9 entry above left as a `🔲`: an
  `openMenus` counter (`openMenu()`/`closeMenu()`) any panel can share instead of each one fighting
  over a single pause boolean, plus `byElectionsPanelOpen` and a `mapFocusRequest` seam (see below).
  `PartyPanel.vue`'s existing expand/collapse toggle was switched onto the same counter.
- `src/stores/game.ts` — `resumeClockIfClear()` replaces the old direct `resumeClock()` call in
  `resolveFeedAction`; it only resumes once both `pendingEvents` and `ui.openMenus` are clear, so two
  panels open at once can't have one's close prematurely resume the clock while the other is still
  open.
- `src/composables/useByElections.ts` (new), `src/components/ContestCard.vue` (new),
  `src/components/ByElectionsPanel.vue` (new) — commons contests listed individually; council
  contests grouped by ISO week into collapsed-by-default `<ContestCard>` lists (council by-elections
  are high-frequency, so expanding every contest by default would bury the rarer, more newsworthy
  parliamentary ones). `GameClock.vue`'s by-elections button (previously a permanently `disabled`
  "coming soon" stub from P1.9) now opens/closes the panel through the shared `openMenus` gate.
- `src/stores/ui.ts` / `src/components/MapView.vue` — `ui.mapFocusRequest` is the only seam
  `useByElections.ts`'s `focusOnMap()` uses to drive the map (per the project rule that the map is
  only ever touched through its own component, never reached into from outside), carrying a target
  view + geometryRef (+ council level for ward drill-down); `MapView.vue` alone interprets it via its
  existing internal `activate()`.
  - **Gotcha hit and fixed:** the "View on map" button's click both (a) emits a Vue component event
    that reactively calls `activate()`, setting `activeRegion`, and (b) is a native DOM click that
    keeps bubbling up to `MapView`'s `window` "click elsewhere deactivates" listener. Browsers run a
    microtask checkpoint after each event-listener invocation during a single dispatch, so by the
    time that bubble reaches `window`, the reactive watcher chain has already run and the listener
    sees an active region it didn't expect on a non-map click — and immediately undoes the focus it
    just set, on the same click. Fixed with `@click.stop` on the button so the click never reaches
    that listener.
- **Scoped deliberately narrow:** step 5 of the task contract (listing the next GE and, once their
  data exists, devolved/council/mayoral/PCC elections alongside by-elections in the same panel) is
  left for later — the panel currently surfaces generated commons/council by-elections only, per the
  acceptance line's explicit requirements.
- Covered by 5 new tests in `src/stores/game.spec.ts` (`useGameStore by-elections — P2.8`):
  deterministic contest generation with matching feed entries over a long run; weekly council feed
  upsert never duplicates; `actionContest` resolves + queues polling impact + updates feed;
  `actionContest` is a no-op on an already-resolved contest; `resumeClockIfClear` only resumes once
  both `pendingEvents` and `ui.openMenus` are clear. Manually verified end-to-end in `npm run dev` via
  Playwright: panel open/close + clock pause/resume, commons and council contest generation and
  grouping, `actionContest` resolving through the UI, and — after the click-bubbling fix above — the
  map actually zooming/dimming/lifting onto both a commons seat and a council ward via "View on map".
- **Acceptance:** clicking the clock opens the by-elections panel and pauses the clock; closing it
  resumes the clock (once no other menu/pending event is also blocking it); commons by-elections are
  individual feed items; council by-elections are grouped weekly but expandable/actionable
  individually; selecting any contest focuses the map on that seat/ward (commons or council-ward
  drill-down).
