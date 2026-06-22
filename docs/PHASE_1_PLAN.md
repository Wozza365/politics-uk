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
> how. Phase 1 is **complete** — see
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
| View switcher (P1.10) | `src/components/ViewSwitcher.vue`, `src/stores/ui.ts` | ✅ Bottom-centre nav bar; only Westminster selectable, rest disabled/upcoming |
| Testing | `vitest`, `src/sim/difficulty.spec.ts`, `src/components/compassMath.spec.ts` | ✅ `npm run test` wired (cross-cutting concern, started early per §3) |
| Simulation engine (P1.11) | `src/sim/{policies,segments,poll,rng}.ts`, `src/data/sim/{policies,segments}.json` | ✅ Deterministic spatial/issue-salience polling model + generic `-1..+1` impact contract wired into `game.tickDay()` |
| End-to-end loop (P1.13) | `src/stores/{game,ui}.ts`, `src/screens/ResultScreen.vue`, `src/screens/GameScreen.vue` | ✅ GE-date win check (`playerSeats >= winThresholdSeats`) wired into `tickDay()`; result screen + "Play again" loop back to the start menu |

Phase 1 is now complete — every task below is `✅ DONE`.

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

### P1.10 — View-switcher shell `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p110--view-switcher-shell-).

### P1.11 — Simulation engine (MVP) `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p111--simulation-engine-mvp-).

### P1.12 — Event system (MVP) `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p112--event-system-mvp-).

### P1.13 — End-to-end loop wire-up `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p113--end-to-end-loop-wire-up-).

### P1.14 — Constituency tooltip data enrichment `✅ DONE`
See [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md#p114--constituency-tooltip-data-enrichment-).

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
                                         └─ P1.12 events ◄─────┴─ P1.13 end-to-end ✅

P1.5 map ─ P1.14 tooltip data enrichment (independent follow-up, no downstream dependents)
```

**Critical path:** P1.0 → P1.1 → P1.4 → (components) → P1.11/P1.12 → P1.13. ✅ All complete —
Phase 1 is done.

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
