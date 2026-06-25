# Politics UK — Phase 2 Work Breakdown

> **Purpose.** A delegable, step-by-step plan for Phase 2 of Politics UK. It is written to be
> handed to an AI coding agent, which may execute tasks directly or fan them out to sub-agents.
> The authoritative design is [`GAME_SPEC.md`](./GAME_SPEC.md); this document turns spec §12
> "Phase 2+" — plus the explicit Phase-2 deferrals scattered through §4.1, §9, and the two Phase 1
> docs — into concrete, ordered, verifiable work.
>
> Phase 0 (Foundations) and Phase 1 (MVP playable shell) are **complete** — see
> [`PHASE_0_COMPLETED.md`](./PHASE_0_COMPLETED.md) and
> [`PHASE_1_COMPLETED.md`](./PHASE_1_COMPLETED.md) for what was built and how. This document only
> carries still-relevant, forward-looking work. Phase 2 is **in progress** — completed Phase 2
> tasks move to [`PHASE_2_COMPLETED.md`](./PHASE_2_COMPLETED.md) the same way, leaving only a
> short pointer behind in each task's place here.

---

## 0. How to use this document

Same conventions as `PHASE_1_PLAN.md`: task IDs (`P2.1`, sub-tasks `P2.1.2`), status legend
(`✅ DONE` / `🔲 TODO` / `🟠 PARTIAL` / `🟡 BLOCKED`), a per-task contract (**Goal**, **Depends
on**, **Steps**, **Files**, **Acceptance criteria**), and the same global definition of done:

1. `npm run build` passes (`vue-tsc -b` then `vite build` — zero type errors, clean production
   build).
2. No new `any` casts beyond those already present, unless justified in a comment.
3. New behaviour is reachable from the running app (`npm run dev`) or covered by a test.
4. Work is committed and pushed with a descriptive message. Do **not** open a PR unless
   explicitly asked.

**Conventions already established in the repo** (match them — see `PHASE_1_PLAN.md` §0 for the
full list): Vue 3 `<script setup lang="ts">` SFCs; Pinia stores (options style); Tailwind v4
utility classes; `@/` → `src/` alias; entity types live in `src/types/`, never redefined inline;
data loaded from JSON under `src/data/scenarios/<id>/`, no game numbers hard-coded in components;
the map is only ever touched through the `MapRenderer` interface (`src/map/MapRenderer.ts`).

---

## 1. Phase 2 — additional governance tiers, views, and depth

### P2.0 — Polling-driven seat projection at the GE

See [`phase2/P2.0-seat-projection.md`](./phase2/P2.0-seat-projection.md).

---

## 2. Additional governance tiers, views, and depth

Per spec §4.1, **every tier is already in the data model's scope** — Phase 1 only shipped the
*view* (map + composition data) for tier 1 (Commons). Phase 2's job is the remaining tiers' data
acquisition + views, plus the richer UI/event/menu work spec §12 defers. Spec §4.1's table is the
authoritative tier list; this plan groups it into delegable batches by data-acquisition similarity
rather than repeating the table.

> **Build order tip.** Each tier-view task (P2.1–P2.4) follows the **exact same four-step shape**
> Phase 0 used for Commons (P0.3.1–P0.3.6 in `PHASE_0_COMPLETED.md`): fetch boundaries → fetch
> composition → merge into the scenario data model → wire the store/view-switcher/renderer. That
> means P2.1–P2.4 are natural, near-independent sub-agent delegation boundaries — each owns its
> own `scripts/data/fetch-<tier>-*.mjs` files and touches the shared scenario/store files only
> additively (new keys in `tiers: Record<TierId, Region[]>`, new `GameView` union members). The
> council tiers (P2.4) are the long tail — batch them together since they share one acquisition
> pattern (Open Council Data UK) rather than treating each of the seven council types as a
> separate task.

### P2.1 — Regional view: Holyrood, Senedd, NI Assembly, London Assembly

See [`phase2/P2.1-regional-view.md`](./phase2/P2.1-regional-view.md).

### P2.2 — Lords (stats only, no map)

See [`phase2/P2.2-lords.md`](./phase2/P2.2-lords.md).

### P2.3 — Mayoralty: London, combined-authority, and other local mayors `✅ DONE`

See
[`PHASE_2_COMPLETED.md`](./PHASE_2_COMPLETED.md#p23--mayoralty-london-combined-authority-and-other-local-mayors-)
for the full record of what was built.

### P2.4 — Council tiers (the long tail)

See [`phase2/P2.4-council-tiers.md`](./phase2/P2.4-council-tiers.md).

### P2.5 — Hex-map renderer

See [`phase2/P2.5-hex-map-renderer.md`](./phase2/P2.5-hex-map-renderer.md).

### P2.6 — Full event library + authoring tooling

See [`phase2/P2.6-event-library.md`](./phase2/P2.6-event-library.md).

### P2.7 — Clickable hemicycle drill-down

See [`phase2/P2.7-hemicycle-drilldown.md`](./phase2/P2.7-hemicycle-drilldown.md).

### P2.8 — Expandable clock / by-elections panel

See [`phase2/P2.8-clock-panel.md`](./phase2/P2.8-clock-panel.md).

### P2.9 — Deeper Democracy-3-style menus & charts (expanded party panel)

See [`phase2/P2.9-party-panel-levers.md`](./phase2/P2.9-party-panel-levers.md).

### P2.10 — Additional scenarios

See [`phase2/P2.10-additional-scenarios.md`](./phase2/P2.10-additional-scenarios.md).

### P2.11 — Mayoral boundary geometry

See [`phase2/P2.11-mayoral-boundaries.md`](./phase2/P2.11-mayoral-boundaries.md).

---

## 3. Cross-cutting concerns (apply throughout, unchanged from Phase 1)

- **Testing.** Continue the Vitest pattern — unit-test new pure logic (new tier seat-count
  validators, hex-grid math, lever effect functions) the same way `src/sim/*.spec.ts` and
  `src/stores/game.spec.ts` already do.
- **Determinism.** No `Math.random()` anywhere in the sim path — `src/sim/rng.ts`'s seeded
  `mulberry32` PRNG is the established pattern; reuse it for anything new that needs
  pseudo-randomness (e.g. seat-redistribution-at-GE logic from P2.0, if that ends up randomised
  rather than projected).
- **Data provenance.** Every newly-acquired figure that isn't a hard reported fact carries
  `source: 'estimated'`/`'official'`/etc. per the existing per-field convention
  (`RegionDemographics.source`, `PartyFinance.source`, `PolicyStance.source`) and is footnoted in
  UI — never present a guess as reported fact (spec §4.2).
- **Validation.** Every new tier's composition data needs a `validate-scenario.mjs` check that its
  seat counts reconcile to the known total (129, 60, 90, 25, …) — follow the existing Commons-650
  check as the template.
- **Performance.** Boundaries for the devolved/council tiers should go through the same
  `mapshaper -simplify 10% keep-shapes` step Commons used (16MB → 592KB) before being committed —
  don't skip simplification because a tier's geometry is smaller; the council tier especially
  (~370 authorities, many subdivided into wards) could otherwise bloat the bundle. Consider dynamic
  `import()` per-view (spec performance note already flagged this risk in `PHASE_1_PLAN.md` §3)
  now that there are 5+ boundary sets instead of 1 — a player who never opens the councils view
  shouldn't pay for its JSON in the initial bundle.
- **Renderer discipline.** Every new view continues to go through `MapRenderer` —
  `src/map/MapRenderer.ts`'s interface is the one non-negotiable architectural rule (spec §9.1);
  P2.5's hex renderer is the proof this held.
- **No further scope creep.** Anything not named in spec §12 or this document (new tiers beyond
  §4.1's table, mechanics beyond §9.3's lever list, renderers beyond hex/SVG/Tres) is Phase 3+ —
  stub seams, don't build them speculatively.

---

## A. Dependency graph & suggested execution order

```
Phase 1 ✅ (done — see PHASE_1_COMPLETED.md, including P1.13)
   │
   ├─ P2.0 polling-driven seat projection ── independent of everything else below
   │
   ├─ P2.1 Regional view (Holyrood/Senedd/NI/London Assembly) ─┬─ (shares boundaries/composition/view pattern)
   ├─ P2.2 Lords stats                                         │
   ├─ P2.3 mayors                                              │
   └─ P2.4 councils (long tail) ───────────────────────────────┘
   │
   ├─ P2.5 hex-map renderer (independent — pure MapRenderer impl, no data dependency)
   ├─ P2.6 event library + authoring tooling (independent — content, not mechanics)
   ├─ P2.7 hemicycle drill-down (depends on whichever tier views exist by then, for real data to drill into)
   ├─ P2.8 expandable clock panel (independent; benefits from P2.4's council-election dates existing)
   ├─ P2.9 expanded party panel / levers (independent of tiers; the big gameplay item)
   ├─ P2.10 additional scenarios (independent; re-runs the existing data pipeline)
   └─ P2.11 mayoral boundary geometry (depends on P2.3's Mayoralty[] existing, which it now does)
```

**Critical path:** none — P2.0–P2.11 are all parallelisable. P2.1–P2.4 (tier data + views) are the
natural first wave since they share one acquisition pattern and unblock P2.7's real drill-down
data; P2.0/P2.5/P2.6/P2.9/P2.10 have no data dependency on the others and can proceed concurrently
from day one; P2.11 only needs P2.3, already done.

**Good sub-agent delegation boundaries:** each of P2.1–P2.4 owns its own `scripts/data/fetch-*.mjs`
files and only touches shared files (`build-scenario.mjs`, `validate-scenario.mjs`,
`stores/scenario.ts`) additively; P2.5 (renderer), P2.6 (events), P2.9 (levers) each own a
self-contained slice of `src/map/`, `src/data/scenarios/*/events.*.json`, and
`src/components/PartyPanel.vue` respectively.

---

## B. Open questions carried into Phase 2

These aren't blocking — they're flagged inline in the relevant task above, repeated here for
visibility:

1. **P2.0** — does the seat-projection model use a uniform-national-swing approach (per-seat,
   using each seat's last `results` breakdown from P1.14) or a simpler proportional-from-vote-share
   model? Left to whoever picks up the task; the uniform-swing approach is the more defensible
   psephological default if the per-task effort allows it.
2. **P2.3** — how should mayors (no natural multi-region map tier) be represented? Resolved as a
   stats list, not a map overlay — see `PHASE_2_COMPLETED.md`'s P2.3 entry for why.
3. **P2.4** — resolved: the "councils" view remains one nav entry, with an authority-level
   sub-switcher. Each selected council level renders its own non-overlapping seat/authority set;
   unrepresented areas may remain grey rather than being assigned to a false seat.
4. **P2.10** — "custom-generated" scenarios (spec §12's phrase) have no defined mechanism. Treat
   as out of scope until a future spec revision defines what "custom-generated" means.
