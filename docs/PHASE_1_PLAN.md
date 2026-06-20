# Politics UK — Phase 1 Work Breakdown

> **Purpose.** A delegable, step-by-step plan for completing Phase 1 (MVP
> playable shell) of Politics UK. It is written to be handed to an AI
> coding agent, which may execute tasks directly or fan them out to
> sub-agents. The authoritative design is
> [`GAME_SPEC.md`](./GAME_SPEC.md); this document turns spec §12 Phase 1
> into concrete, ordered, verifiable work.
>
> Phase 0 (Foundations) is **complete** — see
> [`PHASE_0_COMPLETED.md`](./PHASE_0_COMPLETED.md) for what was built and
> how. It's kept in a separate file so this document only carries
> still-relevant, forward-looking work.

---

## 0. How to use this document

**Task IDs.** Every task has an ID like `P1.6` and sub-tasks like `P1.6.2`. Use these to
declare dependencies and to report progress. Do tasks in dependency order (see §A, the
dependency graph) — not necessarily numeric order.

**Status legend.** Each task is tagged:
- `✅ DONE` — already implemented and committed; listed for context only.
- `🔲 TODO` — not started.
- `🟡 BLOCKED` — cannot complete in the current environment; do the parts you can and leave a
  clearly-labelled stub.

**Per-task contract.** Each task gives: **Goal**, **Depends on**, **Steps**, **Files**,
**Acceptance criteria**. A task is "done" only when every acceptance criterion passes.

**Global definition of done** (applies to every code task):
1. `npm run build` passes (this runs `vue-tsc -b` then `vite build` — i.e. zero type
   errors and a clean production build).
2. No new `any` casts beyond those already present, unless justified in a comment.
3. New behaviour is reachable from the running app (`npm run dev`) or covered by a test.
4. Work is committed and pushed directly to `master` with a descriptive message. Do **not**
   open a PR unless explicitly asked.

**Conventions already established in the repo** (match them):
- Vue 3 `<script setup lang="ts">` SFCs; Composition API.
- Pinia stores in `src/stores/`, defined with `defineStore` (options style, as in
  `scenario.ts`) — keep that style for consistency.
- Tailwind v4 (via `@tailwindcss/vite`); utility classes in templates, `@import "tailwindcss"`
  in `src/style.css`. No `tailwind.config.js` unless a theme extension needs one.
- Path alias `@/` → `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).
- Entity types live in `src/types/`; never redefine them inline.
- Data is loaded from JSON under `src/data/scenarios/<id>/`; **no game numbers hard-coded
  in components** (spec §7.3).
- The map is only ever touched through the `MapRenderer` interface (spec §9.1) — never
  reach into SVG/DOM from game logic or components other than the renderer itself.

---

## 1. Current state (what already exists)

Phase 0 is fully complete (see [`PHASE_0_COMPLETED.md`](./PHASE_0_COMPLETED.md)). In short:

| Area | Files | State |
| --- | --- | --- |
| Scaffold | `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.ts`, `src/style.css` | ✅ Vite + Vue 3 + TS + Pinia + Tailwind v4, `@/` alias, builds clean |
| Entity types | `src/types/{party,region,scenario,policy,index}.ts` | ✅ Mirrors spec §4.2 + the 2D political-compass model |
| Renderer | `src/map/MapRenderer.ts` (interface), `src/map/SvgMapRenderer.ts` (impl) | ✅ d3-geo + topojson-client; hover/click events |
| Map component | `src/components/MapView.vue` | ✅ CSS faux-3D wrapper + tooltip; renders real Commons data |
| Store | `src/stores/scenario.ts` | ✅ Loads the real `uk-2025-01-01` scenario + boundaries |
| Data | `src/data/scenarios/uk-2025-01-01/{boundaries.commons,composition.commons,parties,scenario,sources}.json` | ✅ Real: 650 Commons seats, 15 parties, polling/finance/membership snapshot |
| Data scripts + validator | `scripts/data/*.mjs` | ✅ Reproducible fetch/build pipeline + `npm run validate:data` |

Everything in Phase 1 below is TODO. The real Commons geometry already exists, so **P1.5 no
longer depends on a blocked data step** — it can use the live store data directly.

---

## 2. Phase 1 — MVP playable shell

Phase 1 turns the foundations into a playable loop: **Start menu → Loading → Game screen**
(spec §6), with the Westminster map, hemicycle, party stats, event feed, a ticking clock with
GE countdown, a view-switcher shell, and a minimal event/polling loop.

> **Build order tip.** Stand up the **state layer (P1.0–P1.1)** first, then the **screens/
> components (P1.2–P1.10)** can be built largely in parallel by sub-agents against those
> stores, then **engine + events (P1.11–P1.12)** make the numbers move, and **P1.13** wires
> the loop end-to-end. The map, hemicycle, party panel, feed, and clock are independent
> components and are the natural delegation boundaries.

### P1.0 — App shell & screen routing `🔲`
**Goal.** A single source of truth for "which screen are we on" and transitions between them.

**Depends on:** P0.1 (done).

**Steps:**
1. Decide routing approach: a lightweight **`useUiStore`** with a `screen: 'start' | 'loading'
   | 'game'` state is sufficient for 3 screens and avoids a router dependency. (Use `vue-router`
   only if deep-linking/back-button is wanted — not needed for MVP.) **Recommend the store.**
2. Create `src/stores/ui.ts` with `screen` state and actions `goToStart()`, `goToLoading()`,
   `goToGame()`.
3. In `src/App.vue`, render the current screen component via `<component :is>` or `v-if`
   on `ui.screen`. Remove the temporary direct-`MapView` mount.
4. Create placeholder screen components: `src/screens/StartScreen.vue`,
   `LoadingScreen.vue`, `GameScreen.vue` (empty shells for now).

**Files:** `src/stores/ui.ts`; `src/screens/{StartScreen,LoadingScreen,GameScreen}.vue`;
modify `src/App.vue`.

**Acceptance:** App boots to Start; manually flipping `ui.screen` swaps screens; build clean.

### P1.1 — Game state stores `🔲`
**Goal.** The mutable game state the whole UI reads/writes: selected party, simulated date,
clock run-state, live polling, finance, membership, feed entries.

**Depends on:** P1.0, scenario store (done, P0.2/P0.3).

**Steps:**
1. Create `src/stores/game.ts` (`useGameStore`). State:
   - `selectedPartyId: PartyId | null`
   - `date: ISODate` (starts at `scenario.date`)
   - `clock: { running: boolean; msPerDay: number }` (default `msPerDay = 15000`, spec §9.5)
   - `polling: Record<PartyId, number>` (initialised from `scenario.polling`)
   - `feed: FeedEntry[]` (see P1.8 for the type)
   - `pendingEvent: GameEvent | null` (an action-required event currently blocking, P1.12)
2. Actions: `startGame(partyId)`, `tickDay()`, `pauseClock()`, `resumeClock()`,
   `recordFeedEntry(entry)`, `resolvePendingEvent(choiceId)`.
3. Derived getters: `selectedParty`, `commonsSeatsByParty`, `playerSeatCount`,
   `playerPollingPct`, `daysUntilElection` (needs `nextElectionDate` — add to scenario or a
   constant for MVP), `winThresholdSeats` = `Math.floor(totalSeats / 2) + 1` (spec §11.2 —
   **never hard-code 326**; derive from the scenario's seat total).
4. Keep the **clock mechanism** (the `setInterval`/`requestAnimationFrame` driver) out of the
   store; the store exposes `tickDay()` and run-state, and a composable drives it (P1.9).

**Files:** `src/stores/game.ts`.

**Acceptance:** `startGame('labour')` sets selected party, seeds `polling` from scenario, and
leaves the clock paused until the game screen mounts; getters compute correctly against the
dataset; build clean.

### P1.2 — Start menu `🔲`
**Goal.** Spec §7: locked timeline selector + party cards + difficulty badges + Start.

**Depends on:** P1.0, P1.1, scenario store.

#### P1.2.1 — Timeline selector
**Steps:** Render a slider (spec §7.1) with a **single selectable stop** (`2025-01-01`),
architected for more stops later (drive options from an array even though it has one entry).
Show the chosen date label. Selecting it sets the active scenario id.
**Acceptance:** Slider present, one stop, displays `1 January 2025`; structure supports adding
stops without a rewrite.

#### P1.2.2 — Party cards
**Steps:**
1. Create `src/components/PartyCard.vue`. Props: a `Party` + its scenario figures.
2. Render only **selectable** parties: `scope === 'national'` (spec §7.2). Regional/local
   parties are excluded from the picker but **remain in the data model** (they still appear on
   the map/hemicycle).
3. Card layout (spec §7.2): party name (top); **leader portrait placeholder** showing the
   leader's name (middle); details — leader, Commons seats, total council seats, plus
   at-a-glance extras (devolved seats, headline polling %); difficulty badge (P1.2.3); and the
   party's **compass summary** (P1.2.5) as a small at-a-glance circle.
4. Style the card **in the party's colours** using `colours.primary` as background and
   `colours.onPrimary` as text (already WCAG-verified at data-build time). Pull every
   number from the scenario store — **no hard-coded figures** (spec §7.3).
**Acceptance:** One card per national party, correctly coloured with readable text, all figures
sourced from data; clicking selects the party.

#### P1.2.3 — Difficulty badge
**Steps:**
1. Create `src/sim/difficulty.ts` implementing spec §11.1: a 1–5 band from a **popularity
   proxy** (current polling % + weighted seat share across tiers) and a **realistic-path-to-
   power** term, with a **small-party weighting** that eases very small parties so they're
   hard-but-not-impossible (capped below "impossible").
2. For MVP, seat-share weighting may use Commons seats only (other tiers arrive in Phase 2);
   structure the function to accept additional tiers later.
3. Render the band as a badge on `PartyCard`.
**Acceptance:** Indicative banding sanity-checks against spec §11.1 (governing party easier,
minor parties hard but capped); pure function, unit-testable.

#### P1.2.4 — Start button
**Steps:** A `Start` button, disabled until a party is selected; on click calls
`game.startGame(partyId)` then `ui.goToLoading()`.
**Acceptance:** Disabled with no selection; starts the game with the chosen party + scenario.

#### P1.2.5 — Political-compass view (shared component)
**Goal.** Spec §4.4: render party positions on the **2D political compass** — economic
(left↔right) × social (libertarian↔authoritarian) — as **lightly shaded, bordered circles**
whose **radius grows as `consistency` falls**. Reused by the party card (compact, overall
`compass` summary) and the party panel (P1.7, fuller view). **Build it once, parameterised.**
**Steps:**
1. Create `src/components/CompassView.vue`. Props: an array of plotted items
   `{ position: CompassPosition; consistency: number; colour: string; label?: string }` plus a
   `size`/`compact` flag.
2. Draw the 2D plane: quadrant gridlines and axis labels (economic x, social y), each item as a
   circle centred at `(position.economic, position.social)` mapped to plane coords, radius a
   function of `1 − consistency`, filled with the party colour at low opacity + a solid border.
3. **Compact mode** (card): just the party's overall `compass` circle, minimal chrome.
   **Full mode** (panel): can later overlay multiple parties and/or per-policy stances (Phase 2
   detail — keep the prop shape ready, don't build the per-policy cloud yet).
4. Use the existing `MapRenderer`-style discipline: this is a pure presentational component
   driven by data; **no game logic inside**. Types come from `src/types/policy.ts`.
**Acceptance:** Given a `CompassSummary` + colour, renders a correctly-placed, correctly-sized
shaded circle with axis labels; compact and full modes both work; unit test covers the
position→coords and consistency→radius mapping.

**Files (P1.2):** `src/screens/StartScreen.vue`, `src/components/PartyCard.vue`,
`src/components/DifficultyBadge.vue`, `src/components/CompassView.vue`, `src/sim/difficulty.ts`.

### P1.3 — Loading screen `🔲`
**Goal.** Spec §8: centred spinner while scenario data, boundaries, and derived state load.

**Depends on:** P1.0.

**Steps:** Centred spinner + placeholder copy; theme the accent with the selected party's
colour. Since data is bundled (imported JSON), simulate a short load (e.g. await
microtask/`requestIdleCallback` + a minimum visible duration) then `ui.goToGame()`. Keep a real
async hook so swapping to fetched data later needs no structural change.
**Acceptance:** Spinner shows, accent matches selected party, auto-advances to game.

### P1.4 — Game screen layout `🔲`
**Goal.** Spec §9 layout: map centre; event feed top-left (no panel behind it); party stats
top-centre; clock + GE countdown top-right; hemicycle under the map; view-switcher
bottom-centre. Everything overlaid on a neutral backdrop.

**Depends on:** P1.0.

**Steps:** Build `GameScreen.vue` as a full-viewport layout (CSS grid / absolute regions per
the ASCII layout in spec §9). Drop in placeholder slots for each sub-component so they can be
filled independently (good delegation seams). The map sits centrally and behind the overlaid
text UI.
**Acceptance:** All six regions positioned per spec §9; responsive enough not to overlap at
common desktop sizes; build clean.

### P1.5 — Westminster map in the game screen `🔲`
**Goal.** Spec §9.1: the existing `MapView` integrated as the central map, zoom + pan + hover
stats, coloured by holding party.

**Depends on:** P1.4. (Real Commons geometry already exists in the store — no longer blocked.)

**Steps:**
1. Reuse `MapView.vue`; mount it in the centre slot of `GameScreen`.
2. Add **zoom + pan** (wheel-zoom + drag-pan). Implement at the component/CSS level (transform)
   or via a `d3-zoom` integration inside `SvgMapRenderer` — keep zoom state out of game logic.
3. Hover tooltip already shows MP/party/majority; extend to vote share when present (not
   currently populated — see `PHASE_0_COMPLETED.md` P0.3.2 notes).
4. Region fill comes from current holding party colour (already wired); ensure it reads live
   composition from the store, not a placeholder constant.
**Acceptance:** Map fills centre, zoom/pan works, hover shows real stats, colours match holders;
faux-3D treatment retained.

### P1.6 — Hemicycle (party-makeup dots) `🔲`
**Goal.** Spec §9.2: dot diagram of seat composition for the current view's tier.

**Depends on:** P1.4.

**Steps:**
1. Create `src/components/HemicycleView.vue`. Compute seat totals per party from the store's
   composition for the active tier (Commons at MVP).
2. Lay out dots in a **hemicycle** (parliament arc). For Commons (650), **1 dot = 1 seat**;
   design the layout fn to accept a `seatsPerDot` scale so thousand-seat tiers later use
   `1 dot = 10/100` with a footnote (spec §9.2). A standard approach: distribute seats across
   concentric rows of the arc proportional to radius.
3. Colour each dot by party (`colours.primary`). Order parties left→right by political lean if
   available, else by seat count.
4. Mark dots up as **hover-ready now, clickable later** (add the markup/handlers but leave the
   drill-down as a Phase 2 stub).
**Acceptance:** Dot count equals total seats (650), party groupings and colours correct, arc
reads cleanly; `seatsPerDot` parameter proven by a unit test even if Commons uses 1.

### P1.7 — Top-centre party panel (collapsed) `🔲`
**Goal.** Spec §9.3 collapsed view (expandable levers are Phase 2 — stub the expand affordance).

**Depends on:** P1.1.

**Steps:**
1. Create `src/components/PartyPanel.vue`. Show, for the **player's** party:
   - party name; current polling % (0 dp);
   - **two seat figures** — Commons (prominent) and a combined "everything else" elected total
     (smaller); **Lords shown separately**, never in the combined total (spec §9.3);
   - party finance (estimated; flagged); membership;
   - confirmed extras: leader approval rating, vote-share **trend arrow** (momentum), councils
     controlled, days since last election;
   - the party's **compass summary** via `CompassView` (P1.2.5) — the player's overall position.
2. All values from `game`/`scenario` stores. For MVP, tiers beyond Commons (and Lords — not yet
   gathered, see `PHASE_0_COMPLETED.md`) may be 0/"—" with a footnote until that data exists —
   but the **layout** must already accommodate them.
3. Add a non-functional "expand" affordance that, per spec §9.5, will later pause the clock when
   opened — wire the pause hook now even if the expanded panel is empty.
**Acceptance:** Collapsed panel shows all listed fields from data; estimates visibly flagged;
trend arrow reflects polling momentum; build clean.

### P1.8 — Event feed `🔲`
**Goal.** Spec §9.4: a text-style feed (no panel/background), newest at the **bottom**
(spec §13 resolved: chronological == newest-at-bottom).

**Depends on:** P1.1.

**Steps:**
1. Define `FeedEntry` in `src/types/` (or `src/types/event.ts`): `{ id, date: ISODate,
   headline: string, actionTaken?: string }`.
2. Create `src/components/EventFeed.vue`. Render `game.feed` directly on the backdrop (no
   container chrome): **bold headline**, the action taken below it (if any), and a simple date.
3. Order chronological, **newest at the bottom**; auto-scroll to the latest entry as it appears.
**Acceptance:** Entries render headline/action/date with correct styling and ordering;
auto-scrolls; reads live from the store.

### P1.9 — Game clock + GE countdown `🔲`
**Goal.** Spec §9.5: visible simulated date, auto-advances **one day per ~15s**, GE countdown,
pauses on action-events (and later on open menus).

**Depends on:** P1.1.

**Steps:**
1. Create `src/composables/useGameClock.ts`: drives `game.tickDay()` on an interval of
   `game.clock.msPerDay` while `game.clock.running`. Use a single timer; clean up on unmount.
   Prefer a drift-correcting timer (compare timestamps) over naïve `setInterval`.
2. Create `src/components/GameClock.vue`: show the current simulated date and a **countdown to
   the next General Election** (`daysUntilElection` getter). The clock UI is an interactive
   element later (by-elections list) — leave a stub affordance.
3. **Pause/resume rules** (spec §9.5): pause when an action-required event is pending
   (`game.pendingEvent != null`); resume on resolution. (Menu-open pause is Phase 2 but wire the
   same pause path so it's trivial to extend.)
**Acceptance:** Date advances ~1 day/15s, pauses when an action event fires and resumes when
resolved, GE countdown decrements; timer cleaned up on unmount (no leaks/double-timers).

### P1.10 — View-switcher shell `🔲`
**Goal.** Spec §9.6: bottom-centre nav bar to switch map/hemicycle views; **only Westminster
active** at MVP, others shown as upcoming/disabled.

**Depends on:** P1.4.

**Steps:** Create `src/components/ViewSwitcher.vue` with a tab/nav bar listing views
(Westminster, Holyrood, Senedd, NI, London, Councils…). Westminster active; the rest rendered
**disabled** with an "coming soon" affordance. Selecting a view sets `ui.activeView` (add to the
UI store); MVP only reacts to Westminster.
**Acceptance:** Bar shows all views with only Westminster selectable; selection state stored;
disabled items are visibly inactive and non-interactive.

### P1.11 — Simulation engine (MVP) `🔲`
**Goal.** Spec §10.5: a **deterministic** spatial/issue-salience model that moves polling from
day one. MVP = a working, balanced minimal version; depth comes later.

**Depends on:** P1.1.

#### P1.11.1 — Policy registry + compass types
**Goal.** Spec §4.4 (resolved): the **2D political-compass** model. Stance/compass types
already live in `src/types/policy.ts` (`CompassPosition`, `PolicyDef`, `PolicyStance`,
`CompassSummary`) — **use them, don't redefine**.
**Steps:**
1. In `src/sim/policies.ts` (or `src/data/sim/policies.json`), define the **policy registry**: the
   **major (~8–10)** and **minor (~16–20, some `partySpecific`)** areas from spec §4.4. Treat the
   illustrative lists there as the provisional starting set; refine when scoring manifestos.
2. Each policy is positioned on the **2D compass** (economic × social), not a 1D value. Major
   policies carry a larger **tier weight** than minor ones in the sim.
3. Provide a `salience: Record<PolicyId, number>` for the world's current issue salience.
**Acceptance:** Registry centralised with major/minor tiers; `Party.stances` is keyed by these
`PolicyId`s and typed as `PolicyStance`; types compile; no duplicate stance type definitions.

#### P1.11.2 — Voter segments + party base
**Steps:** In `src/sim/segments.ts`, define voter segments positioned in the **same 2D compass
space**, each with a size weight, plus per-party **core base** positions. For MVP these can be a
small hand-authored set in `src/data/sim/segments.json` (flagged as tunable/estimated). Structure
for later data-driven refinement.
**Acceptance:** Segments + bases load from data with 2D positions; sum of segment weights normalised.

#### P1.11.3 — Polling update function
**Steps:** In `src/sim/poll.ts`, implement: `polling = f(alignment(party, segment) weighted by
policy tier × salience) − baseBetrayalPenalty(party movement vs core base)` (spec §10.5.1 step 5).
Alignment is **2D distance** on the compass; a stance's `consistency` modulates exposure (a fuzzy
position pleases fewer voters intensely but is less betrayal-prone). Pure, deterministic,
synchronous, client-side. Normalise outputs so the field sums sensibly.
**Acceptance:** Pure function; given identical inputs returns identical outputs; no randomness in
the core path (any procedural variety must be seeded/deterministic).

#### P1.11.4 — Validate against the spec's worked examples
**Steps:** Add unit tests reproducing spec §10.5.2: (a) immigration salience → ~0 ⇒ Reform dips;
(b) governing party occupies green space ⇒ Greens squeezed; (c) Greens adopt anti-environment ⇒
base-betrayal collapse among their segment. Assert the **direction** of each move.
**Acceptance:** All three qualitative outcomes reproduced by tests.

**Files (P1.11):** `src/sim/{policies,segments,poll,difficulty}.ts`,
`src/data/sim/{policies,segments}.json`, plus tests. (Stance/compass **types** already exist in
`src/types/policy.ts` — reuse them.)

### P1.12 — Event system (MVP) `🔲`
**Goal.** Spec §10 + §9.5: a daily event roll from a weighted pool; some events require a player
decision (which pauses the clock and is recorded to the feed). MVP = a handful of seeded events,
with and without actions.

**Depends on:** P1.1, P1.11 (effects feed the engine), P1.8 (feed), P1.9 (clock pause).

#### P1.12.1 — Event data format
**Steps:** Design and document a data-driven event schema (this is spec §13's open "event
schema" item — propose, then confirm). Minimum fields: `id`, `headline`, `body?`, `scope`
(`local|regional|national|international`), `weight`, optional `triggers`/`conditions`, `effects`
(deltas to axis positions/salience/finance/membership/seats), and optional `actions: [{ id,
label, effects }]` for player-decision events. Put the schema in `src/types/event.ts` and a short
note in `GAME_SPEC.md` §10 (replace "Format TBD").
**Acceptance:** `GameEvent` type compiles; schema documented; a couple of seeded events authored
in `src/data/scenarios/uk-2025-01-01/events.seed.json`.

#### P1.12.2 — Event roll + dispatch
**Steps:** In `src/sim/events.ts`: on `tickDay()`, roll from the weighted pool (deterministic
seeded RNG so runs are reproducible). Mix **real/historical** seeds (so early play tracks
reality) with **fictional/procedural** ones (spec §10). Apply non-action event effects
immediately via the engine; for action events, set `game.pendingEvent`, **pause the clock**, and
highlight the relevant UI area (spec §10 / §9.5).
**Acceptance:** Ticking generates feed entries; most events have little/no effect, some move
numbers; action events pause the clock until resolved.

#### P1.12.3 — Action resolution
**Steps:** A modal/inline prompt renders `pendingEvent.actions`; choosing one applies its
effects through the engine, records the choice under the event in the feed (spec §9.4), clears
`pendingEvent`, and resumes the clock.
**Acceptance:** Player choice applies effects, appears in the feed beneath the headline, and the
clock resumes.

### P1.13 — End-to-end loop wire-up `🔲`
**Goal.** A coherent playable slice: pick a party → load → play days → events fire → polling
drifts → numbers update across map/hemicycle/panel/feed → GE countdown runs toward a win check.

**Depends on:** P1.2–P1.12.

**Steps:**
1. Confirm the full path Start → Loading → Game works with real wiring (not placeholders).
2. On each `tickDay()`: advance date, roll events (P1.12), update polling (P1.11), refresh all
   bound UI (map/hemicycle/panel/feed/clock are reactive to stores, so this should be automatic).
3. Implement the **win check** at the GE date: `playerSeats > totalSeats / 2` (spec §11.2);
   show a minimal win/lose result. (A full results screen is Phase 2; MVP just needs the
   condition evaluated and surfaced.)
4. Manual playthrough QA pass; fix reactivity gaps.
**Acceptance:** A user can play from the start menu through ticking days with live, drifting
numbers and resolvable events, to a GE win/lose evaluation; `npm run build` clean.

---

## 3. Cross-cutting concerns (apply throughout)

- **Testing.** Add **Vitest** early (P1.1-ish). Unit-test pure logic: `sim/poll.ts`,
  `sim/difficulty.ts`, hemicycle layout, WCAG contrast, data validation. Component tests
  optional for MVP. Add `npm run test`.
- **Accessibility.** Party-card contrast is already enforced at data-build time; also ensure
  interactive controls are keyboard-reachable and the map has non-colour-only affordances where
  feasible.
- **Determinism.** No `Math.random()` in the sim path — use a seeded PRNG so runs are
  reproducible and testable (spec §10.5 rationale).
- **Performance.** Boundaries are already simplified for web (592KB); keep the hemicycle and map
  re-renders cheap (the clock ticks every 15s, but action handling shouldn't thrash). Profile if
  the map redraws fully on every tick — diff/patch fills rather than rebuilding paths if needed.
  Note: bundling `scenario.json` + `boundaries.commons.json` directly pushes the main JS chunk to
  ~830KB; consider a dynamic `import()` for scenario data if this becomes a problem.
- **Data provenance.** Anything estimated carries `source: 'estimated'` and is footnoted in UI
  (spec §4.2). Never present a guess as reported fact.
- **No scope creep into Phase 2.** Devolved/London/council views, hex-map renderer, full event
  library + authoring tools, clickable hemicycle drill-down, expandable clock/menus, deeper
  Democracy-style menus/charts, and additional scenarios are **Phase 2+** (spec §12) — stub their
  seams, don't build them.

---

## A. Dependency graph & suggested execution order

```
Phase 0 ✅ (done — see PHASE_0_COMPLETED.md)
   │
   └─ P1.0 app shell ─ P1.1 game stores ─┬─ P1.2 start menu ─ P1.2.3 difficulty
                                         ├─ P1.3 loading
                                         ├─ P1.4 game layout ─┬─ P1.5 map
                                         │                    ├─ P1.6 hemicycle
                                         │                    ├─ P1.7 party panel
                                         │                    ├─ P1.8 feed
                                         │                    ├─ P1.9 clock
                                         │                    └─ P1.10 view switcher
                                         ├─ P1.11 sim engine ─┐
                                         └─ P1.12 events ◄─────┴─ P1.13 end-to-end
```

**Critical path:** P1.0 → P1.1 → P1.4 → (components) → P1.11/P1.12 → P1.13.

**Parallelisable once P1.1 + P1.4 exist** (good sub-agent boundaries — each owns its files):
P1.5 (map), P1.6 (hemicycle), P1.7 (panel), P1.8 (feed), P1.9 (clock), P1.10 (switcher),
and P1.11 (engine) can all proceed concurrently. P1.2/P1.3 (start/loading) are independent of
the game-screen components and can also run in parallel.

---

## B. Decisions — all resolved (spec §13)

The product owner has answered the previously-open questions; recorded here for the executing
agent. **No decisions block this plan.**
1. ✅ **Policy axes** — **2D political compass** (economic left↔right × social
   libertarian↔authoritarian) with a `consistency` circle, split into **major (~8–10, weighted
   more)** and **minor (~16–20, some party-specific)** tiers (spec §4.4). Drives P1.2.5, P1.11.1.
   The exact area lists are still refined *when scoring manifestos*, but the model and
   provisional lists are set.
2. ✅ **Event schema** — design it as part of P1.12.1 (no pre-approval needed).
3. ✅ **Party finance** — **pure estimates are fine**, no factual basis required; use a real
   reference point where handy, else approximate from members/seats. Always flag `estimated`
   (already applied in Phase 0). This *removes* the earlier constraint — don't block on
   sourcing real finance figures.
4. ✅ **Working title** — "Politics UK" placeholder confirmed.
