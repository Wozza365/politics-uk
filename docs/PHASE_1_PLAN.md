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
> how. Phase 1 is **in progress**; P1.0–P1.9 are done — see
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
| Simulation engine (P1.11) | `src/sim/{policies,segments,poll,rng}.ts`, `src/data/sim/{policies,segments}.json` | ✅ Deterministic spatial/issue-salience polling model + generic `-1..+1` impact contract wired into `game.tickDay()` |

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

### P1.8 — Event feed `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p18--event-feed-).

### P1.9 — Game clock + GE countdown `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p19--game-clock--ge-countdown-).

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

### P1.11 — Simulation engine (MVP) `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p111--simulation-engine-mvp-).

### P1.12 — Event system (MVP) `✅ DONE`
**Goal.** Spec §10 + §9.5: a daily event roll from a weighted pool; some events require a player
decision (which pauses the clock and is recorded to the feed). MVP = a handful of seeded events,
with and without actions.

**What shipped:**
- `src/types/event.ts` — the `GameEvent` schema (id, headline, body?, scope, severity, weight,
  optional date `window`, `once`, `effects` (polling deltas targeting a fixed party / `'player'` /
  `'incumbent'`, plus `salienceShift` + a feed `summary`), optional `actions` (each with its own
  `effects`), and an optional `callbackId` escape hatch — documented in `GAME_SPEC.md` §10.
- `src/sim/events.ts` — `rollEventForDay()`: deterministic (seeded, not `Math.random`) daily roll
  weighted against a "nothing happens" outcome, filtered to events whose `window` covers the
  current date and that haven't already fired; `resolvePollingEffects()` resolves `'player'`/
  `'incumbent'` to concrete party ids.
- `src/sim/eventCallbacks.ts` — a small registry for event/action logic that depends on *current*
  game state (e.g. "boost whoever currently governs") rather than anything a flat data effect can
  express.
- `src/data/scenarios/uk-2025-01-01/events.seed.json` — always-eligible ambient/minor events
  (a tweet row, local flooding, viral clips…).
- `src/data/scenarios/uk-2025-01-01/events.scripted.json` — date-windowed, more dramatic events: a
  by-election (bounded away from the GE date), England winning the 2026 World Cup (bank holiday,
  via callback), Trump declaring war on Iran (bounded to the start of his term), recurring annual/
  seasonal events (New Year Honours, summer wildfire warnings, winter storms, a local football
  promotion party) each authored per-year with its own window.
- `src/stores/game.ts` — `tickDay()` rolls the event, applies non-action effects immediately or
  queues an action event + pauses the clock; `resolveFeedAction()` applies the chosen action's
  effects through the engine, runs its callback if any, records the result in the feed, and
  resumes the clock once no events remain.
**Acceptance:** ✅ Ticking generates feed entries; most days have no event; some move polling/
salience; action events pause the clock until resolved via the feed's choice buttons.

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
