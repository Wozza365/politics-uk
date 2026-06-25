# Politics UK

UK political simulator. Vite + Vue 3 (`<script setup>`, Composition API) + Pinia (options-style
stores) + Tailwind v4. Path alias `@/` → `src/`.

**Don't read this whole repo's docs by default.** The design/planning docs are intentionally
large and split so you only need a sliver of them per task:

- `docs/GAME_SPEC.md` — full design authority. Only open the specific `§N` section a task
  references; don't read it end-to-end.
- `docs/PHASE_<N>_PLAN.md` — current phase's work breakdown, task IDs (`P<N>.<M>`). Read the
  "How to use this document" + conventions section once per session at most.
- `docs/phase<N>/P<N>.<M>-*.md` — one task's full contract (Goal/Steps/Files/Acceptance). This is
  almost always the *only* doc file you need to open to do the work.
- `docs/PHASE_<N>_COMPLETED.md` — historical record of finished tasks. Only read the entry for a
  task you're extending, not the whole file.
- `src/data/scenarios/<id>/README.md` — explains that scenario's data, e.g. why
  `uk-2025-01-01` ships placeholder fixtures.

Use the `phase-task` skill to pick up a task by ID without over-reading; use the `data-tier`
skill when a task is "add a new governance tier" (boundaries + composition + view).

## Commands

```sh
npm run dev              # dev server
npm run build             # vue-tsc -b && vite build — the type/build gate
npm run test               # vitest
npm run validate:data      # scenario data integrity (seat counts, refs)
```

## Conventions (don't re-derive these — they're stable across phases)

- Entity types live in `src/types/`, never redefined inline.
- Data is loaded from JSON under `src/data/scenarios/<id>/`; no game numbers hard-coded in
  components.
- The map is only ever touched through the `MapRenderer` interface (`src/map/MapRenderer.ts`) —
  never reach into SVG/DOM from game logic or other components.
- Per-tier map colouring logic lives in `src/map/regionState/` (one file per tier, sharing
  `buildSeatRegionState.ts`'s helper) — add a new file there for a new tier, don't grow
  `MapView.vue`.
- `validate-scenario.mjs` is one `validate<Concern>()` function per check, called from a thin
  `validate()` orchestrator — add a new function for a new check, don't grow an existing one.
- A panel's derived stats (polling/seats/finance/...) belong in a `use<X>Stats.ts` composable, not
  inline in the component — see `usePartyStats.ts`. Repeated card/row markup belongs in a small
  presentational component (see `PartyStatCard.vue`) instead of being copy-pasted per stat.
- No `Math.random()` in the sim path — use the seeded `mulberry32` PRNG (`src/sim/rng.ts`).
- Non-hard-fact figures carry a `source: 'estimated' | 'official' | ...` field per the existing
  per-field convention, and are footnoted in UI.
- New boundary geometry goes through `mapshaper -simplify 10% keep-shapes` before committing.

## Definition of done (every task, every phase)

1. `npm run build` passes — zero type errors, clean production build.
2. No new `any` beyond what's already present, unless justified with a one-line comment.
3. New behaviour is reachable from `npm run dev` or covered by a test.
4. Commit and push with a descriptive message. **Never open a PR unless explicitly asked.**
5. If you finish or substantially progress a tracked task, flip its status marker in the phase
   plan doc (and move finished detail into the `*_COMPLETED.md` file, leaving a short pointer —
   see existing entries for the pattern). This keeps the next session's context small.

## Working efficiently

- Tasks marked "independent" in a phase plan's dependency graph are good candidates to delegate
  to a subagent (via the Agent tool) rather than researching inline — keeps this session's
  context free for integration work.
- Prefer grep/glob for a specific symbol over reading whole files; prefer reading one task's
  `docs/phase<N>/P<N>.<M>-*.md` over the full phase plan.
