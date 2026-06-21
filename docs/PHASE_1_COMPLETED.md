# Politics UK — Phase 1: completed so far

> Phase 1 is **in progress** — this file is the record of what's already
> built and how, kept out of [`PHASE_1_PLAN.md`](./PHASE_1_PLAN.md) so that
> document only carries still-relevant, forward-looking work. The
> authoritative design remains [`GAME_SPEC.md`](./GAME_SPEC.md). See
> `PHASE_1_PLAN.md` §A for what's still open and the current critical path.

## P1.0 — App shell & screen routing ✅

Commit `6a70eaf`.

- `src/stores/ui.ts`: `useUiStore` with `screen: 'start' | 'loading' | 'game'`
  and `goToStart()/goToLoading()/goToGame()` actions.
- `src/App.vue` renders the current screen via a `screens` lookup map +
  `<component :is>`, driven by `ui.screen`.
- `src/screens/{StartScreen,LoadingScreen,GameScreen}.vue` created (the
  latter is still a placeholder — see `PHASE_1_PLAN.md` P1.4).

## P1.1 — Game state stores ✅

Commit `6a70eaf`.

- `src/stores/game.ts` (`useGameStore`): `selectedPartyId`, `date`, `clock
  {running, msPerDay}`, `polling`, `feed`, `pendingEvent`.
- Actions: `startGame(partyId)`, `tickDay()`, `pauseClock()`,
  `resumeClock()`, `recordFeedEntry()`, `resolvePendingEvent(choiceId)`.
- Getters: `selectedParty`, `commonsSeatsByParty`, `playerSeatCount`,
  `playerPollingPct`, `winThresholdSeats` (derived from the scenario's seat
  total, never hard-coded), `daysUntilElection`.
- `resolvePendingEvent` currently just clears `pendingEvent` and resumes the
  clock — applying the chosen action's actual effects is P1.12's job once
  `GameEvent`/actions exist; the hook point is already wired.
- `src/types/event.ts`: minimal `FeedEntry` type (full `GameEvent` type for
  action-required events is still P1.12).
- The clock-driving composable (`useGameClock`) is deliberately **not**
  built yet — that's P1.9; the store only exposes `tickDay()`/run-state per
  the plan.

## P1.2 — Start menu ✅

Commit `342e34c` (party cards/start button/timeline/compass), refined in
`e5b6476` (difficulty rework).

- **P1.2.1 Timeline selector** — `StartScreen.vue` renders a range slider
  driven by a `TimelineStop[]` array (currently one stop, `1 January 2025`);
  adding stops later needs no rewrite.
- **P1.2.2 Party cards** — `src/components/PartyCard.vue`, one per
  `scope: 'national'` party, styled in the party's own colours
  (`colours.primary`/`onPrimary`), all figures sourced from the scenario
  store. Devolved/council seat figures show `—` (that data doesn't exist
  yet — Phase 2+, per `PHASE_0_COMPLETED.md`).
- **P1.2.3 Difficulty badge** — `src/sim/difficulty.ts` +
  `src/components/DifficultyBadge.vue`. Bands a party 1–5 from a blended
  **popularity proxy** (40% current polling, 60% Commons seat share,
  structured to accept more tiers later via `extraTiers`), ranked
  **relative to the rest of the selectable field** (not an absolute
  threshold), with a square-root easing curve on rank percentile so
  small/fringe parties compress into "Very Hard" rather than every
  non-leading party flatlining at "Extreme". Pure function; covered by
  `src/sim/difficulty.spec.ts`.
- **P1.2.4 Start button** — disabled until a party is selected; calls
  `game.startGame(partyId)` then `ui.goToLoading()`.
- **P1.2.5 Political-compass view** — `src/components/CompassView.vue` +
  `src/components/compassMath.ts` (position→coordinate and
  consistency→radius mapping, unit-tested in `compassMath.spec.ts`).
  Compact mode used on the party card today; full mode (multi-party/overlay)
  is ready for the party panel (P1.7) when that's built.

## P1.3 — Loading screen ✅

Commit `342e34c`.

- `src/screens/LoadingScreen.vue`: centred spinner, accent border coloured
  with the selected party's `colours.primary`, real `async`/`await`
  structure (currently just a fixed delay, since data is bundled) so
  swapping in genuinely-async loading later is a one-line change.
  Auto-advances to `ui.goToGame()`.

## P1.5 — Westminster map zoom, pan, and focus (partial) 🟠

Commits `e5b6476` (manual zoom/pan), `65a403a` (click-to-activate
constituency focus + tilt), `3daf1f1` (size-proportional focus zoom +
transition polish).

Done, ahead of the original P1.5 ask:
- Manual **wheel-zoom, drag-to-pan, and pinch-zoom** on the map
  (`MapView.vue`), independent of which `MapRenderer` backend is mounted.
- **Click a constituency to focus it**: zooms in centred on that region,
  steepens the map's tilt (flat by default, dramatic angle while focused),
  lifts the focused region slightly with its own drop-shadow, dims
  everything else, and disables manual zoom/pan while active.
- The focus zoom level is **proportional to the constituency's size**
  relative to the rest of the dataset (log-scaled ranking of bounding-box
  diagonal via `SvgMapRenderer.getRegionSizeExtent()`/`getRegionBounds()`),
  not a single fixed zoom for every region.
- Snap transition tuned for smoothness: separate easing for the transform
  (800ms) vs. an overlaid background blur (faded in/out, ~1000ms total,
  applied only to non-focused regions via `setBackgroundBlur()`) that masks
  GPU-compositing artifacts (soft edges, transient colour shifts) the
  browser produces while the combined tilt+zoom transform is animating —
  a deliberate cover-up, not a root-cause fix; see `MapView.vue`'s comments
  for what was tried (an ancestor `filter`, then `will-change: transform` —
  the latter caused a regression and was reverted).
- Hover tooltip already shows MP/party/majority (not vote share — not yet
  populated in the dataset, see `PHASE_0_COMPLETED.md` P0.3.2).

Still open (carried forward in `PHASE_1_PLAN.md`'s P1.5): formal
integration into the P1.4 game-screen layout once that exists — today the
map is mounted standalone in `GameScreen.vue`'s placeholder, not yet
alongside the hemicycle/panel/feed/clock.
