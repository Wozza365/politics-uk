---
name: data-tier
description: Scaffold a new governance-tier or scenario data pipeline (boundaries + composition + scenario wiring + view). Use for tasks like regional view, lords, councils, mayoralties, or any future tier/scenario that follows the established fetch/merge/wire pattern — instead of re-deriving the pattern from PHASE_0_COMPLETED.md or GAME_SPEC.md each time.
---

This 4-step shape was established in Phase 0 (Commons) and repeated for every tier since
(Holyrood/Senedd/NI/London Assembly, Lords, mayoralties). Don't read those phases' full writeups
to rediscover it — follow this:

1. **Fetch boundaries**: `scripts/data/fetch-<tier>-boundaries.mjs`, pulling raw geometry from the
   source named in the task file (e.g. ONS/Open Council Data UK). Simplify before committing:
   `mapshaper <file> -simplify 10% keep-shapes -o format=topojson force <file>`.
2. **Fetch composition**: `scripts/data/fetch-<tier>-composition.mjs` — seat/membership data for
   the same tier.
3. **Merge into the scenario**: extend `scripts/data/build-scenario.mjs` to join boundaries +
   composition into `Scenario.tiers: Record<TierId, Region[]>` (or a sibling top-level key if the
   data isn't `Region`/`Seat` shaped, e.g. `Mayoralty[]` — see `PHASE_2_COMPLETED.md`'s P2.3 entry
   for that precedent). Additive only — don't restructure existing tiers' shape.
4. **Wire it up**: `src/stores/scenario.ts` getters, a `ViewSwitcher.vue` nav entry, the view
   component — rendered only through `src/map/MapRenderer.ts`, never direct SVG/DOM access. The
   tier's region-colouring logic goes in its own `src/map/regionState/<tier>.ts` file (reuse
   `buildSeatRegionState.ts`'s shared helper) — don't add another `build<Tier>RegionState` inline
   in `MapView.vue`.

Also required, every time:
- Add a `validateTier`-shaped check (or a new `validate<Concern>()` function alongside it) in
  `validate-scenario.mjs` confirming the new tier's seat/membership count reconciles to the known
  total for that body — don't grow an existing validate function for an unrelated concern.
- Tag any figure that isn't a hard reported fact with `source: 'estimated' | 'official' | ...`.
- Reuse one fetch script across similar sub-types (e.g. all council types) rather than writing a
  bespoke script per sub-type — only split files where the source data itself is genuinely
  different.

Read the specific task's `docs/phase<N>/P<N>.<M>-*.md` file for what tier/source this instance
needs — this skill covers the repeated mechanics, not the per-tier specifics.
