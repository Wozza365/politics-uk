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
> how. Phase 1 is **in progress**; P1.0–P1.7 are done — see
> [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md) for what was built and
> how. Both are kept in separate files so this document only carries
> still-relevant, forward-looking work.

---

## 0. How to use this document

**Task IDs.** Every task has an ID like `P1.6` and sub-tasks like `P1.6.2`. Use these to
declare dependencies and to report progress. Do tasks in dependency order (see §A, the
dependency graph) — not necessarily numeric order.

**Status legend.** Each task is tagged:
- `✅ DONE` — already implemented and committed; listed for context only.
- `🔲 TODO` — not started.
- `🟠 PARTIAL` — some of the task is already done (see `PHASE_1_COMPLETED.md`); the remaining
  steps are still listed below.
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
| Renderer | `src/map/MapRenderer.ts` (interface), `src/map/SvgMapRenderer.ts` (impl) | ✅ d3-geo + topojson-client; hover/click events; size-proportional region focus zoom |
| Map component | `src/components/MapView.vue` | ✅ CSS faux-3D wrapper + tooltip; renders real Commons data; zoom/pan + click-to-focus |
| Store | `src/stores/scenario.ts` | ✅ Loads the real `uk-2025-01-01` scenario + boundaries |
| Data | `src/data/scenarios/uk-2025-01-01/{boundaries.commons,composition.commons,parties,scenario,sources}.json` | ✅ Real: 650 Commons seats, 15 parties, polling/finance/membership snapshot |
| Data scripts + validator | `scripts/data/*.mjs` | ✅ Reproducible fetch/build pipeline + `npm run validate:data` |

Phase 1 progress so far (see [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md) for detail):

| Area | Files | State |
| --- | --- | --- |
| App shell + routing (P1.0) | `src/stores/ui.ts`, `src/App.vue`, `src/screens/*.vue` | ✅ Screen state + routing; `GameScreen.vue` is the full six-region layout (P1.4) |
| Game state store (P1.1) | `src/stores/game.ts`, `src/types/event.ts` | ✅ Selected party, date, clock state, polling, feed, pending-event hook |
| Start menu (P1.2) | `src/screens/StartScreen.vue`, `src/components/{PartyCard,DifficultyBadge,CompassView}.vue`, `src/sim/difficulty.ts` | ✅ Timeline stub, party cards, difficulty banding, compass view, Start button |
| Loading screen (P1.3) | `src/screens/LoadingScreen.vue` | ✅ |
| Westminster map (P1.4, P1.5) | `src/screens/GameScreen.vue`, `src/components/MapView.vue`, `src/map/SvgMapRenderer.ts` | ✅ Game-screen layout built; map zoom/pan/focus integrated into its centre slot |
| Testing | `vitest`, `src/sim/difficulty.spec.ts`, `src/components/compassMath.spec.ts` | ✅ `npm run test` wired (cross-cutting concern, started early per §3) |

Everything else in Phase 1 below is TODO.

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

### P1.0 — App shell & screen routing `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p10--app-shell--screen-routing-).

### P1.1 — Game state stores `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p11--game-state-stores-).

### P1.2 — Start menu `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p12--start-menu-). All five sub-tasks
(P1.2.1–P1.2.5: timeline selector, party cards, difficulty badge, Start button, compass view)
are done.

### P1.3 — Loading screen `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p13--loading-screen-).

### P1.4 — Game screen layout `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p14--game-screen-layout-).

### P1.5 — Westminster map in the game screen `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p15--westminster-map-zoom-pan-and-focus-).

### P1.6 — Hemicycle (party-makeup dots) `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p16--hemicycle-party-makeup-dots-).

### P1.7 — Top-centre party panel (collapsed) `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p17--top-centre-party-panel-collapsed-).

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

### P1.14 — Constituency tooltip data enrichment `🔲`
**Goal.** Spec §9.1's hover tooltip currently shows MP/party/majority only. Extend it with the
**full previous-election result** (not just the winner) and other constituency-level reference
data, so the tooltip becomes a useful at-a-glance dossier and a future cross-reference point
against census data.

**Depends on:** P1.5 (tooltip exists); a data step, not a `MapView` change (see
`PHASE_0_COMPLETED.md` P0.3.2 notes on why vote share isn't in the dataset yet).

**Steps:**
1. Extend the constituency data (`src/data/scenarios/uk-2025-01-01/composition.commons.json` or a
   new per-constituency dataset) with the **full previous-election breakdown**: vote share for
   every candidate/party (not just the winner), turnout, and electorate size.
2. Add constituency-level reference data useful for later cross-referencing against ONS census
   data — candidates to include: median age, average/median household income, population
   density, urban/rural classification, employment rate, and highest-qualification mix. Source
   from ONS where feasible; flag anything estimated/approximated per spec §4.2 (`source:
   'estimated'`).
3. Update the `MapRenderer` tooltip data contract and `MapView.vue`'s tooltip rendering to
   surface the new fields (vote-share breakdown as a mini bar/list, demographics as a compact
   stat block).
4. Extend `scripts/data/*.mjs` + `npm run validate:data` to fetch/validate the new fields,
   following the existing reproducible-pipeline convention.
**Acceptance:** Hovering a constituency shows full previous-election vote shares + turnout
alongside the existing MP/party/majority, plus the added demographic stats; every non-official
figure is flagged with its source; `npm run validate:data` and `npm run build` pass.

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

P1.5 map ─ P1.14 tooltip data enrichment (independent follow-up, no downstream dependents)
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
