# Politics UK — Phase 2: completed so far

> Phase 2 is **in progress** — this file is the record of what's already
> built and how, kept out of [`PHASE_2_PLAN.md`](./PHASE_2_PLAN.md) so that
> document only carries still-relevant, forward-looking work. The
> authoritative design remains [`GAME_SPEC.md`](./GAME_SPEC.md). See
> `PHASE_2_PLAN.md` §A for what's still open and the current critical path.

## P2.1 — Regional view: Holyrood, Senedd, NI Assembly, London Assembly ✅

- One combined **Regional** view, not four separate ones: `src/stores/ui.ts`'s `GameView` union
  collapsed `holyrood`/`senedd`/`ni-assembly`/`london` into a single `'regional'` member;
  `ViewSwitcher.vue` now shows three buttons (Westminster / Regional / Councils) instead of six.
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
  (P2.1/P2.3/P2.4 are still open) — and per the doc's own no-speculative-building rule, a generic
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
