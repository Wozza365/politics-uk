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
> carries still-relevant, forward-looking work.

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

## 1. Outstanding from Phase 1 — do this first

**P1.13 — End-to-end loop wire-up is still `🔲 TODO`.** `PHASE_1_PLAN.md` lists it last but the
codebase confirms it was never finished: `src/stores/game.ts` has `winThresholdSeats` and
`daysUntilElection` getters but nothing ever *checks* the win condition, there is no GE
resolution, and no win/lose UI exists anywhere in `src/screens/` or `src/components/`. Building
devolved/council tiers (this document's whole point) on top of an election loop that never
actually concludes would compound the gap, so:

### P2.0 — Finish P1.13: GE resolution + win/lose screen `🔲`
**Goal.** When `game.date` reaches `scenario.nextElectionDate`, stop the clock, run the Commons
seat tally, evaluate `playerSeats > totalSeats / 2` (spec §11.2, already expressed correctly as
`winThresholdSeats` in `src/stores/game.ts:87-91` — **do not** hard-code 326), and show a minimal
result screen.

**Depends on:** nothing new — all the pieces (`tickDay`, `winThresholdSeats`,
`commonsSeatsByParty`) already exist in `src/stores/game.ts`.

**Steps:**
1. In `tickDay()` (`src/stores/game.ts:147`), after advancing the date, check
   `this.date === scenario.scenario.nextElectionDate`. On match: stop rolling events for the day,
   pause the clock, and set a new `electionResult` state field (winner, player seat count,
   `winThresholdSeats`, win/lose bool).
2. Add a results screen (`src/screens/ResultsScreen.vue`, wired into `useUiStore`'s `Screen` union
   alongside `'start' | 'loading' | 'game'`) shown when `game.electionResult` is set — headline
   win/lose, final seat count vs threshold, a button back to the start screen.
3. Seat tally only needs to reconcile Commons seats *held* at the GE date, which currently never
   changes during play (events only move `polling`, not `Region.seats`) — note this gap rather
   than hiding it: an MVP win check legitimately judges on **polling-projected** seats, not actual
   simulated seat changes, until P2.x's deeper sim (out of scope here) redistributes seats. Decide
   and document which one this resolves against; the spec (§11.2) just says "seats", and projecting
   from final polling via a uniform swing or similar is an acceptable MVP interpretation — state
   the choice in the commit message and in this file once decided.
4. Manual playthrough QA: fast-forward (the dev-added skip-day button) to the GE date, confirm the
   result screen appears and the win/lose call matches the numbers shown.

**Files:** `src/stores/game.ts`, `src/screens/ResultsScreen.vue` (new), `src/stores/ui.ts`,
`src/types/*` if a new result type is needed.

**Acceptance:** playing to the GE date always produces a result screen; `npm run build` clean;
the win/lose boolean matches `playerSeats > totalSeats / 2` against whatever seat figure step 3
settles on.

---

## 2. Phase 2 — additional governance tiers, views, and depth

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

### P2.1 — Devolved parliaments: Holyrood, Senedd, NI Assembly `🔲`

**Goal.** Three new tiers + views: Scottish Parliament (129 MSPs), Senedd (60 MS on the
2025-01-01 date — **not** the 96-member 2026 system, see spec §4.1 footnote 1), NI Assembly (90
MLAs).

**Depends on:** P2.0 not required, but should land before/alongside it if both are in flight —
no actual code dependency.

**Steps:**
1. **Boundaries.** Fetch each parliament's constituency/region boundaries (ONS Open Geography
   Portal has Scottish Parliament constituencies/regions and Senedd constituencies; NI Assembly
   uses the 18 Westminster-coincident constituencies per spec §4.1 row 5, so its boundary set may
   be derivable from the existing Commons boundaries rather than a fresh fetch — confirm before
   re-fetching). Follow the `fetch-commons-boundaries.mjs` pattern: GeoJSON → TopoJSON → `mapshaper`
   simplify, output `boundaries.<tier>.json` under `src/data/scenarios/uk-2025-01-01/`.
2. **Composition.** Build `composition.<tier>.json` (one `Region[]` array, keyed the same shape as
   `composition.commons.json`) as of 2025-01-01: each parliament's own open-data portal or
   Wikipedia snapshot per spec §5.1. Each region holds `seats: Seat[]` — note constituency *and*
   list members both being MSPs/MS/MLAs for the same body means some regions are themselves
   "list" regions with multiple seats, not one-seat-per-region like Commons; model that explicitly
   rather than forcing the Commons one-seat shape.
3. **Wire into the scenario.** Extend `scripts/data/build-scenario.mjs` to merge each new tier's
   `Region[]` into `Scenario.tiers` under its `TierId` (`"holyrood"`, `"senedd"`,
   `"ni-assembly"` — these string literals already exist as `GameView` union members in
   `src/stores/ui.ts:5`, so reuse them as the `TierId` too for consistency unless a reason emerges
   not to). Re-run `npm run validate:data` — extend
   `scripts/data/validate-scenario.mjs` to check each new tier's seat count against the known
   total (129 / 60 / 90).
4. **View wiring.** `src/components/MapView.vue` and `src/map/SvgMapRenderer.ts` currently assume
   one `BoundarySet`/`RegionState` per mount; make the boundary set passed to `MapRenderer.render()`
   depend on `useUiStore().activeView` rather than always being the Commons one. `ViewSwitcher.vue`
   already lists all six views (`src/components/ViewSwitcher.vue`) and disables every
   non-Westminster button — flip `holyrood`/`senedd`/`ni-assembly` to `available` once their data
   + boundary set exist.
5. **Hemicycle.** `src/components/HemicycleView.vue` + `src/sim/hemicycle.ts` already key off
   "current view's tier" composition generically (per spec §9.2) — confirm it reads
   `scenario.scenario.tiers[uiStore.activeView]` (or equivalent) rather than being hardcoded to
   `commonsRegions`, and fix that coupling if it's still Commons-only from the P1 build.

**Files:** `scripts/data/fetch-{holyrood,senedd,ni-assembly}-boundaries.mjs` (new),
`scripts/data/fetch-{holyrood,senedd,ni-assembly}-composition.mjs` (new),
`scripts/data/build-scenario.mjs`, `scripts/data/validate-scenario.mjs`,
`src/data/scenarios/uk-2025-01-01/{boundaries,composition}.{holyrood,senedd,ni-assembly}.json`
(new), `src/stores/scenario.ts`, `src/components/MapView.vue`, `src/map/SvgMapRenderer.ts`,
`src/components/{ViewSwitcher,HemicycleView}.vue`.

**Acceptance:** the view switcher can flip between Westminster/Holyrood/Senedd/NI Assembly, each
showing its own real boundaries, real composition-derived hemicycle, and (per spec §9.1) areas
with no representation at that tier render muted/non-interactive where applicable (e.g. England
has no Holyrood seats); `npm run validate:data` and `npm run build` clean.

### P2.2 — Lords (stats only, no map) `🔲`

**Goal.** Per `PHASE_0_COMPLETED.md`'s own note ("Lords… not yet started… would need its own
small acquisition step"), get real Lords-by-party-group figures into the party panel instead of
the current "—" placeholder (spec §4.1 row 2 — Phase column says **P1**, so this is genuinely
overdue, not new Phase 2 scope; included here since it never got its own task in `PHASE_1_PLAN.md`
and nothing else picked it up).

**Steps:**
1. Fetch current Lords-by-party-group counts (UK Parliament data, per spec §5.1) as of
   2025-01-01.
2. Add a `lords: Record<PartyId, number>` (or similar) field to `Scenario` (`src/types/scenario.ts`)
   — no map geometry needed, it's a chamber not a constituency map (spec §4.1 row 2: "n/a
   (chamber)").
3. Wire into `src/components/PartyPanel.vue`, replacing its existing "—" placeholder for Lords
   (P1.7 in `PHASE_1_COMPLETED.md` already reserves layout space for this).

**Files:** `scripts/data/fetch-lords-composition.mjs` (new), `src/types/scenario.ts`,
`scripts/data/build-scenario.mjs`, `src/components/PartyPanel.vue`.

**Acceptance:** the party panel shows a real Lords peer count per party group, not a placeholder;
`npm run validate:data` and `npm run build` clean.

### P2.3 — London: Assembly, mayoralty, and combined-authority/local mayors `🔲`

**Goal.** Spec §4.1 rows 6–8: London Assembly (25 AMs across 14 constituencies + a London-wide
list), the London mayoralty, ~12 combined-authority metro mayors, and ~15 other directly-elected
local mayors.

**Steps:**
1. London Assembly follows the same boundaries→composition→view pattern as P2.1 (ONS boundaries
   exist for the 14 Assembly constituencies; the London-wide list members need the same
   multi-seat-per-region modelling called out in P2.1 step 2).
2. Mayors (London, combined-authority, and other directly-elected local) don't need their own map
   tier — they're a single seat each, not a multi-region body — so model them as a lightweight
   `Mayoralty[]` (id, name, regionRef for hover-linking, current `PartyId`, electedAt) rather than
   forcing the `Region`/`Seat` shape designed for multi-seat bodies. Surface them either as a
   filter/overlay on the existing council or London view, or a small stats list — there's no single
   obviously-correct map representation for ~27 disjoint single seats, so this is a genuine design
   decision for whoever picks up this task: resolve it pragmatically rather than over-building, and
   record the choice here once made.
3. Wire London Assembly into the view switcher the same way as P2.1 step 4; the mayoralty
   stats wherever step 2 lands them (likely the party panel or a small new "mayors" stats card,
   not a new full-screen view).

**Files:** `scripts/data/fetch-london-assembly-*.mjs` (new), `scripts/data/fetch-mayors.mjs` (new),
`src/types/*` (new `Mayoralty` type), `scripts/data/build-scenario.mjs`,
`src/stores/scenario.ts`, view-switcher/map wiring as in P2.1.

**Acceptance:** London Assembly is a selectable, real-data view; mayoral data exists in the
scenario and is surfaced somewhere in the UI (exact location is this task's call); `npm run
validate:data` and `npm run build` clean.

### P2.4 — Council tiers (the long tail) `🔲`

**Goal.** Spec §4.1 rows 9–17: Police & Crime Commissioners, county councils, district/borough
councils, unitary authorities, metropolitan boroughs, London boroughs, Scottish/Welsh/NI councils
— ~370 principal authorities in total (parish/town/community councils are explicitly **cut**, see
spec §4.1's decision note — do not build these). A single "councils" view per spec §9.6's nav bar
(`src/components/ViewSwitcher.vue` already has one `councils` entry, not nine).

**Steps:**
1. Source from **Open Council Data UK** (opencouncildata.co.uk) per spec §5.1 — this is the one
   acquisition pattern that covers all nine council-ish rows, so build one reusable fetch/parse
   script rather than nine bespoke ones; PCCs are the exception (Electoral Commission/Wikipedia per
   spec §5.1) since they're not a council composition dataset.
2. Decide the "councils" view's actual map granularity: spec §9.6 lists "councils" as one nav
   entry, but the underlying data spans 9 distinct authority types with overlapping/non-overlapping
   geography (a county council area contains several district councils, for instance) — a single
   flat map of ~370 boundaries coloured by controlling party most directly satisfies spec §9.2's
   "party-makeup dots" hemicycle for an aggregate "councils" tier; whether the *map* also needs a
   sub-switcher between authority types (rather than a single merged geography) is this task's
   design call to make and document.
3. Council composition is by-ward, often dozens of wards per council — `Region.seats: Seat[]`
   already supports multiple seats per region (constituency = council, seats = ward councillors),
   so no type changes should be needed; verify rather than assume the model deforms cleanly at
   this multiplicity before building bespoke scripts.
4. The combined "councils controlled" figure already shown on `PartyPanel.vue` (P1.7,
   `PHASE_1_COMPLETED.md`) currently has nothing real to read — once this lands, point it at real
   per-council majority-control data.

**Files:** `scripts/data/fetch-council-composition.mjs` (new, reusable across council types),
`scripts/data/fetch-pcc-composition.mjs` (new), `src/data/scenarios/uk-2025-01-01/composition.councils.json`
(new — or split per-type if step 2's design call goes that way), `scripts/data/build-scenario.mjs`,
view-switcher/map wiring, `src/components/PartyPanel.vue` (real "councils controlled" figure).

**Acceptance:** a "councils" view exists with real composition data across the principal-authority
tiers in scope; `PartyPanel.vue`'s "councils controlled" stat is real, not a placeholder;
`npm run validate:data` and `npm run build` clean.

### P2.5 — Hex-map renderer `🔲`

**Goal.** Spec §12 lists "hex-map renderer" explicitly as Phase 2+ scope, and spec §5.1 already
names a source (House of Commons Library / Open Innovations constituency hexmaps).

**Depends on:** none of P2.1–P2.4 — purely a `MapRenderer` implementation, same interface contract
as `SvgMapRenderer.ts`.

**Steps:**
1. Fetch the Commons Library/Open Innovations hexmap layout data (a fixed q/r or x/y hex
   coordinate per constituency, not a TopoJSON boundary — this is a *different* `BoundarySet`
   shape conceptually, so check whether `BoundarySet`'s `topology`/`objectKey` contract
   (`src/map/MapRenderer.ts:7-11`) actually fits a hex grid or needs a sibling type; don't force a
   geographic topology abstraction onto a schematic layout if it doesn't fit.
2. Implement `HexMapRenderer` against the existing `MapRenderer` interface — same `mount` /
   `render` / `setEvents` / `resize` / `unmount` / `getRegionBounds` / `getRegionSizeExtent` /
   `setBackgroundBlur` contract `SvgMapRenderer.ts` already implements, so `MapView.vue`'s zoom/
   pan/focus/tooltip logic (P1.5) needs **zero changes** to work with it — that's the entire point
   of the abstraction (spec §9.1's "single non-negotiable design decision").
3. Expose a renderer choice (e.g. a small toggle near `ViewSwitcher.vue`, or per-view default) so
   players can pick geographic vs. hex layout for Westminster at least.

**Files:** `src/map/HexMapRenderer.ts` (new), possibly a new `HexBoundarySet`-like type in
`src/map/MapRenderer.ts`, a small UI toggle component.

**Acceptance:** the hex map renders all 650 Commons constituencies as same-size hexes coloured by
party, with the same hover/click/zoom behaviour as the SVG geographic map, swapped in without
touching `MapView.vue`'s consuming logic beyond which renderer it constructs.

### P2.6 — Full event library + authoring tooling `🔲`

**Goal.** Spec §12 Phase 2+: "Full event library (real + fictional), authoring tooling." Phase 1
shipped the event *system* (schema, roll logic, callbacks, two seed pools) per P1.12 in
`PHASE_1_COMPLETED.md` — this task is about **content volume and an authoring workflow**, not
new mechanics.

**Steps:**
1. Grow `src/data/scenarios/uk-2025-01-01/events.seed.json` and `events.scripted.json` well beyond
   the P1.12 starter set — spec §10.5.3 explicitly recommends **authoring-time LLM use** (Claude
   API, `claude-opus-4-8` per the spec's own naming) to mass-generate first-draft event text +
   numeric effects, which a human/agent then reviews and bakes into the deterministic JSON files —
   never have an LLM decide effects at runtime (spec §10.5.3's "no LLM in the core mechanic"
   decision is **not** revisited by this task).
2. Build a small authoring script (e.g. `scripts/data/author-events.mjs`) that calls the Claude API
   to draft candidate `GameEvent` records against the existing schema
   (`src/types/event.ts`), for a human/reviewing-agent to accept/edit/reject before they're
   committed to the seed/scripted JSON — keep generation and commit as separate steps, never
   auto-write straight to the data files.
3. Cover a wider span of `scope` (local→international) and `severity`, and more `window`-bounded
   scripted events (the recurring-by-year pattern P1.12 already established for New Year Honours/
   storms/etc.) so a full playthrough doesn't feel repetitive.

**Files:** `scripts/data/author-events.mjs` (new), `src/data/scenarios/uk-2025-01-01/events.{seed,scripted}.json`.

**Acceptance:** a meaningfully larger and more varied event pool; `rollEventForDay` (`src/sim/events.ts`)
and its existing tests (`src/sim/events.spec.ts`) still pass unmodified — this task only adds data,
it shouldn't need engine changes.

### P2.7 — Clickable hemicycle drill-down `🔲`

**Goal.** Spec §9.2: hemicycle dots are "clickable later (drill into that party's seats /
breakdown)" — `src/components/HemicycleView.vue` (P1.6, `PHASE_1_COMPLETED.md`) already has
hover-ready, click-stubbed markup for this.

**Steps:**
1. Add a click handler per dot that opens a small breakdown (party's seat list for the active
   tier/view, or a per-seat detail akin to the constituency tooltip's enriched data from P1.14).
2. Respect the existing "view-mode toggle" stub (hemicycle fan ⌒ vs. "house" rows-of-benches =,
   spec §9.2) if that's been built by the time this lands; if not, this task can also wire that
   toggle's actual second layout mode, since they're adjacent UI surface.

**Files:** `src/components/HemicycleView.vue`, `src/sim/hemicycle.ts`.

**Acceptance:** clicking a hemicycle dot surfaces real seat-level detail for that party in the
active view.

### P2.8 — Expandable clock / by-elections panel `🔲`

**Goal.** Spec §9.5: the clock UI is "an interactive element (expandable later to list
by-elections and other minor elections in detail)" — `src/components/GameClock.vue` (P1.9,
`PHASE_1_COMPLETED.md`) is currently a `disabled` button with an `aria-label` describing this as
a future stub.

**Steps:**
1. Build the expanded panel: upcoming by-elections (sourced from `events.scripted.json`'s
   by-election-type entries, or a new dedicated data source if those move out of the generic event
   pool), other minor elections (PCCs, mayors, council elections — once P2.3/P2.4 land their data).
2. Per spec §9.3/§9.5, opening any menu **pauses the game clock** — `useGameClock.ts`'s existing
   pause-on-`pendingEvents` watcher (P1.9) establishes the pattern; reuse it rather than building a
   second pause mechanism (e.g. a generic `ui.openMenus` count the clock composable watches
   alongside `pendingEvents.length`, so this and P2.9's expanded party panel can share one pause
   gate cleanly instead of each owning its own).

**Files:** `src/components/GameClock.vue`, `src/composables/useGameClock.ts`, possibly
`src/stores/ui.ts` (a shared "any menu open" flag).

**Acceptance:** clicking the clock opens a real by-elections/minor-elections panel and pauses the
clock while open; closing it resumes the clock (consistent with the existing pending-event
pause/resume behaviour).

### P2.9 — Deeper Democracy-3-style menus & charts (expanded party panel) `🔲`

**Goal.** Spec §9.3 "Expanded (the player's levers) — (Later)": fundraising, social media
activity, staffing, policy, campaigning, leadership — the actual gameplay levers. This is the
single largest piece of new Phase 2 *gameplay* (as opposed to data/view) work, and the one most
likely to need its own sub-plan once scoped.

**Steps:**
1. `PartyPanel.vue` (P1.7) already wires its "expand" affordance to pause the clock with an empty
   expanded body — build the actual expanded surface.
2. Each lever needs: a UI control, a store action that turns the player's choice into
   `PollingImpact`s / `stances` shifts / finance or membership deltas through the **existing**
   sim seams (`src/sim/poll.ts`'s generic `PollingImpact` contract, `game.applySalienceShift`,
   `Party.stances`) rather than inventing parallel mechanics — e.g. "policy" should literally let
   the player edit their own party's `stances[policyId].position` and feed that into the same
   alignment model events already drive (spec §10.5.1 step 4: "a player action deliberately shifts
   the player party's own position").
3. **Charts** — spec §2 names `vue-echarts` for dashboard charts (not yet a dependency; add it
   when this task starts) for polling-history trend lines (`game.pollingHistory` already exists
   and is populated, just not charted anywhere yet) and similar.
4. Scope this as several sub-tasks (one per lever) once picked up — fundraising and social media
   are the most self-contained starting points (they only touch finance/membership/polling, not
   the compass model); policy is the most architecturally significant (touches `stances`, the
   alignment model, and base-betrayal) and should land after the simpler levers prove the pattern.

**Files:** `src/components/PartyPanel.vue` (expanded body), new lever-specific components/stores,
`src/sim/poll.ts` (only if a genuinely new impact source doesn't fit the existing
`PollingImpact`/`extraImpacts` seam — it should).

**Acceptance:** at least fundraising and social media are real, playable levers that move
finance/membership/polling through the existing sim contract; clock pauses while the panel is
expanded (reusing P2.8's shared menu-pause flag if that landed first).

### P2.10 — Additional scenarios `🔲`

**Goal.** Spec §12: "More scenarios (real + custom-generated)." `PHASE_1_PLAN.md`'s "Decisions"
§B.4 already confirms the timeline selector (`StartScreen.vue`, P1.2.1) was built to accept more
stops without rewrite — this task is about actually producing more dated `Scenario` snapshots,
not UI work.

**Steps:**
1. Pick the next historical date(s) — natural candidates given the existing pipeline: an earlier
   point (pre-2024-boundary-review, if that's wanted) or post-2025 as real polling/composition data
   becomes available with time. Each new scenario is its own `src/data/scenarios/<id>/` directory
   built with the same `scripts/data/*.mjs` pipeline Phase 0 established, just re-run against a
   different as-of date.
2. "Custom-generated" scenarios (spec's phrase) are undefined beyond that one line — treat as an
   open design question for whoever picks this up, not a spec'd feature; don't invent a generation
   mechanism speculatively.
3. Add each new scenario as a new `TimelineStop` in `StartScreen.vue`'s existing array.

**Files:** `src/data/scenarios/<new-id>/*`, `scripts/data/*.mjs` (re-run, not rewritten),
`src/screens/StartScreen.vue` (new timeline stop).

**Acceptance:** at least one additional dated scenario is selectable from the start screen and
fully playable end-to-end, validated the same way as `uk-2025-01-01` (`npm run validate:data`
extended to check whichever scenario id is passed, if it isn't already parameterised).

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
Phase 1 ✅ (done — see PHASE_1_COMPLETED.md), except P1.13 outstanding
   │
   └─ P2.0 finish P1.13 (win/lose) ── independent of everything else below
   │
   ├─ P2.1 devolved parliaments ─┬─ (shares boundaries/composition/view pattern)
   ├─ P2.2 Lords stats           │
   ├─ P2.3 London + mayors       │
   └─ P2.4 councils (long tail) ─┘
   │
   ├─ P2.5 hex-map renderer (independent — pure MapRenderer impl, no data dependency)
   ├─ P2.6 event library + authoring tooling (independent — content, not mechanics)
   ├─ P2.7 hemicycle drill-down (depends on whichever tier views exist by then, for real data to drill into)
   ├─ P2.8 expandable clock panel (independent; benefits from P2.4's council-election dates existing)
   ├─ P2.9 expanded party panel / levers (independent of tiers; the big gameplay item)
   └─ P2.10 additional scenarios (independent; re-runs the existing data pipeline)
```

**Critical path:** none, strictly — P2.0 is small and should land first since it closes a Phase 1
gap, but P2.1–P2.10 are all parallelisable once it's done. P2.1–P2.4 (tier data + views) are the
natural first wave since they share one acquisition pattern and unblock P2.7's real drill-down
data; P2.5/P2.6/P2.9/P2.10 have no data dependency on the others and can proceed concurrently from
day one.

**Good sub-agent delegation boundaries:** each of P2.1–P2.4 owns its own `scripts/data/fetch-*.mjs`
files and only touches shared files (`build-scenario.mjs`, `validate-scenario.mjs`,
`stores/scenario.ts`) additively; P2.5 (renderer), P2.6 (events), P2.9 (levers) each own a
self-contained slice of `src/map/`, `src/data/scenarios/*/events.*.json`, and
`src/components/PartyPanel.vue` respectively.

---

## B. Open questions carried into Phase 2

These aren't blocking — they're flagged inline in the relevant task above, repeated here for
visibility:

1. **P2.0** — does the GE win check resolve against seats *projected from final polling* (a
   uniform-swing-style model) or actual simulated seat changes? Phase 1 never redistributes
   `Region.seats` during play, so a literal "tally current seats" check would always return the
   scenario's starting result regardless of how polling moved — this needs resolving before P2.0
   is "done", not just implemented against whichever interpretation is fastest to type.
2. **P2.3** — how should mayors (no natural multi-region map tier) be represented? A stats list is
   the pragmatic default; a dedicated overlay is the richer option. Left to whoever picks up the
   task.
3. **P2.4** — does the "councils" view need an authority-type sub-switcher, or one merged
   geography? Spec §9.6 implies one nav entry; the underlying data's overlapping geography (county
   vs. district) makes a single flat map an imperfect fit. Left to whoever picks up the task.
4. **P2.10** — "custom-generated" scenarios (spec §12's phrase) have no defined mechanism. Treat
   as out of scope until a future spec revision defines what "custom-generated" means.
