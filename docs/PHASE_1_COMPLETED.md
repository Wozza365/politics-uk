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

## P1.4 — Game screen layout ✅

- `src/screens/GameScreen.vue`: full-viewport (`h-screen w-screen`) absolute-
  positioned layout implementing the spec §9 six-region ASCII layout on a
  neutral `bg-zinc-900` backdrop:
  - Event feed: top-left panel (`absolute left-4 top-4 bottom-4`), no
    background behind the entries themselves (chrome is just the panel
    container).
  - Party panel (`PartyPanel`): top-centre.
  - Game clock + GE countdown: top-right panel (`absolute right-4 top-4`).
  - Map: centred, behind/between the overlaid UI (`absolute inset-x-0
    bottom-32 top-20`), capped at `max-w-6xl`.
  - Hemicycle (`HemicycleView`): bottom-centre, above the view-switcher
    (`absolute bottom-20 left-1/2 -translate-x-1/2`).
  - View-switcher: bottom-centre nav bar (`absolute bottom-4 left-1/2
    -translate-x-1/2`).
- Each region exposes a named `<slot>` (`event-feed`, `clock`, `map`,
  `hemicycle`, `view-switcher`) with a sensible placeholder/default so
  sub-components could be (and were) filled in independently — the
  delegation seam the plan called for.
- Builds clean; regions stay non-overlapping at common desktop sizes via
  fixed offsets + `max-w`/`translate` centring rather than flex/grid reflow.

## P1.5 — Westminster map zoom, pan, and focus ✅

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

Formally integrated into the P1.4 game-screen layout: `MapView` is mounted
in `GameScreen.vue`'s central map slot, positioned alongside the
hemicycle/panel/feed/clock per spec §9's six-region layout.

Richer tooltip content (full previous-election vote share, demographics) is
carried forward as its own task — see `PHASE_1_PLAN.md` P1.14 — not a
blocker for P1.5 completion.

## P1.6 — Hemicycle (party-makeup dots) ✅

Commit `3b022f0`.

- `src/components/HemicycleView.vue`: displays seat composition as a dot diagram in a hemicycle (parliament arc).
- `src/sim/hemicycle.ts`: layout utilities `computeHemicycleLayout()` (distributes dots across concentric rows of the arc) and `getHemicycleDotPosition()` (polar-to-Cartesian coordinate mapping).
- Dot count = total Commons seats (650); 1 dot = 1 seat. Layout structure accepts `seatsPerDot` parameter (e.g., `1 dot = 10 seats` for thousand-seat tiers), proven ready for Phase 2 large tiers even though MVP uses 1.
- Parties ordered left→right by economic compass position when available, else by seat count descending. Each dot coloured by party `colours.primary`.
- Dots are **hover-ready** with tooltips showing party name and seat number. Clickable drill-down is stubbed for Phase 2.
- Legend below the hemicycle shows each party's `shortName` and seat count.
- Integrated into `GameScreen.vue`'s hemicycle slot (bottom-centre panel, per spec §9.2).

## P1.7 — Top-centre party panel (collapsed) ✅

Commit `150b213` (initial build), refined in `e30fa1d` (metrics/history).

- `src/components/PartyPanel.vue`: renders the **player's** party's stats in a collapsed (at-a-glance) panel.
- Fields: party name, current polling % (0 dp), **two seat figures** (Commons prominent, combined "everything else" smaller), party finance (flagged estimated), membership, leader approval rating, vote-share trend arrow (momentum), councils controlled, days-since-last-election.
- All values sourced from `game`/`scenario` stores. Devolved seats and Lords (not in Phase 0 data) show "—" with a footnote; layout accommodates them.
- Compass summary (via `CompassView`, P1.2.5) shows the player's overall position.
- Non-functional "expand" affordance (expand handler wired to pause the clock per spec §9.5 even though expanded panel is empty — Phase 2 work).
- Status badge shows the player's difficulty relative to peers (updated daily from the store).

## P1.8 — Event feed ✅

- `src/types/event.ts`: `FeedEntry` now carries a `status: 'actioned' | 'unactioned'`. An
  `unactioned` entry carries `actions: FeedEntryAction[]` (the choices to render as buttons); an
  `actioned` entry carries `actionTaken` (what was done) and `effect` (placeholder text — real
  simulation effects are P1.11/P1.12's job).
- `src/stores/game.ts`: `feed: FeedEntry[]` was already global state on `useGameStore` (P1.1) —
  pushed to and read from anywhere via the store, no new plumbing needed. Added
  `resolveFeedAction(entryId, actionId)`: flips the entry to `actioned`, records the chosen
  action's label as `actionTaken` plus a placeholder `effect`, and clears `actions`. This is the
  **player's main lever on the game loop** — resolving an unactioned event is how a decision gets
  made; covered by `src/stores/game.spec.ts`.
- `src/components/EventFeed.vue`: renders `game.feed` as scrollable content only (no panel chrome
  of its own) — bold headline, then either the action-taken + effect text (`actioned`) or a row of
  small buttons per `entry.actions` (`unactioned`) that call `resolveFeedAction` on click, then the
  date. Newest entry appended at the bottom; auto-scrolls to it as it appears.
- `GameScreen.vue`'s event-feed region keeps the panel chrome (border/background/header) shared
  with the other HUD panels (spec §9.4, revised) — `EventFeed` is mounted inside it as the
  scrollable body, same split as `GameClock`/`HemicycleView`.
- Verified manually in a running dev server (Playwright-driven Chromium): seeded one actioned and
  one unactioned entry into the store, confirmed the unactioned entry's buttons render, clicking
  one flips it to actioned with the recorded label and placeholder effect text, and the feed
  renders inside the bordered/backdrop-blurred panel.

## P1.9 — Game clock + GE countdown ✅

- `src/stores/game.ts`: `pendingEvent: unknown | null` became `pendingEvents: unknown[]` — an
  array so multiple action-required events can queue up; the clock stays paused while any remain.
  `resolvePendingEvent(choiceId)` now shifts the resolved event off the front and only resumes the
  clock once the array is empty.
- `src/composables/useGameClock.ts`: drives `game.tickDay()` with a single drift-correcting
  `setTimeout` chain (tracks remaining time to the next tick rather than naïvely re-arming a fixed
  interval, so a pause doesn't lose or double-count progress towards the next day). Watches
  `game.clock.running` to start/stop the timer, and watches `game.pendingEvents.length > 0` to
  auto-call `pauseClock()` the moment an action-required event appears — `resolvePendingEvent`
  already resumes on the way out, so the same pause path covers the future menu-open case (Phase
  2) for free. Cleans up via `onScopeDispose` (works both for component unmount and for the
  `effectScope`-based unit tests in `useGameClock.spec.ts`, which cover ticking, pause/resume,
  remaining-time carry-over across a pause, auto-pause on a pending event, resume on resolution,
  and timer cleanup on dispose).
- `src/components/GameClock.vue`: shows the simulated date and `daysUntilElection` countdown.
  Mounts `useGameClock()` and kicks the clock off via `resumeClock()` on mount (nothing else
  started it before this), unless an event is already pending. The whole block is a `disabled`
  button with an `aria-label` describing future by-election interactivity — the stub affordance
  the plan calls for.
- **Clock icon**: a plain circle, no hands/numbers/markers. Fill is a `conic-gradient` driven by
  a registered custom property (`@property --clock-fill`) animated through a linear
  `@keyframes` triangle wave (0 → 1 over day one, 1 → 0 over day two, repeating every
  `2 × msPerDay`) — filled portion is the player's party colour, the rest is `transparent`.
  `animation-play-state` is bound to `game.clock.running`, so the fill freezes exactly where it is
  when the clock pauses and continues from there on resume, with no JS-driven animation loop
  needed.
- Verified manually in a running dev server (Playwright-driven Chromium): screenshotted the icon
  filling clockwise across day one, ticking over to day two and unfilling, and confirmed pushing a
  fake entry onto `game.pendingEvents` froze both the date and the icon's fill until cleared.
