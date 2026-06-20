# Politics UK — Phase 0 & 1 Work Breakdown

> **Purpose.** A delegable, step-by-step plan for completing Phase 0 (Foundations) and
> Phase 1 (MVP playable shell) of Politics UK. It is written to be handed to an AI
> coding agent, which may execute tasks directly or fan them out to sub-agents.
> The authoritative design is [`GAME_SPEC.md`](./GAME_SPEC.md); this document turns
> spec §12 Phase 0/1 into concrete, ordered, verifiable work.

---

## 0. How to use this document

**Task IDs.** Every task has an ID like `P1.6` and sub-tasks like `P1.6.2`. Use these to
declare dependencies and to report progress. Do tasks in dependency order (see §A, the
dependency graph) — not necessarily numeric order.

**Status legend.** Each task is tagged:
- `✅ DONE` — already implemented and committed; listed for context only.
- `🔲 TODO` — not started.
- `🟡 BLOCKED` — cannot complete in the current environment (e.g. needs network egress
  that the sandbox denies); do the parts you can and leave a clearly-labelled stub.

**Per-task contract.** Each task gives: **Goal**, **Depends on**, **Steps**, **Files**,
**Acceptance criteria**. A task is "done" only when every acceptance criterion passes.

**Global definition of done** (applies to every code task):
1. `npm run build` passes (this runs `vue-tsc -b` then `vite build` — i.e. zero type
   errors and a clean production build).
2. No new `any` casts beyond those already present, unless justified in a comment.
3. New behaviour is reachable from the running app (`npm run dev`) or covered by a test.
4. Work is committed to branch `claude/tender-archimedes-rvajub` with a descriptive message.
   Do **not** open a PR unless explicitly asked.

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

## 1. Current state snapshot (what already exists)

Phase 0 tasks **P0.1** and **P0.2** are complete and committed. Present in the repo:

| Area | Files | State |
| --- | --- | --- |
| Scaffold | `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.ts`, `src/style.css` | ✅ Vite + Vue 3 + TS + Pinia + Tailwind v4, `@/` alias, builds clean |
| Entity types | `src/types/{party,region,scenario,index}.ts` | ✅ Mirrors spec §4.2 |
| Renderer | `src/map/MapRenderer.ts` (interface), `src/map/SvgMapRenderer.ts` (impl) | ✅ d3-geo + topojson-client; hover/click events |
| Map component | `src/components/MapView.vue` | ✅ CSS faux-3D wrapper + tooltip; renders Commons placeholder |
| Store | `src/stores/scenario.ts` | ✅ Loads placeholder scenario + boundaries |
| Data | `src/data/scenarios/uk-2025-01-01/{boundaries,composition}.placeholder.json`, `README.md` | 🟡 **Placeholder only** — real UK data blocked by sandbox network policy |
| Data scripts | `scripts/data/{build-placeholder-boundaries,fetch-commons-boundaries}.mjs` | ✅ placeholder generator; 🟡 real fetcher unverified/unrun |

The single outstanding Phase 0 item is **real data (P0.3)**; everything in Phase 1 is TODO.

---

## 2. Phase 0 — Foundations (remaining)

### P0.1 — Project scaffold `✅ DONE`
Vite + Vue 3 + TS + Pinia + Tailwind, `@/` alias, builds clean. No action.

### P0.2 — Renderer abstraction + `SvgMapRenderer` `✅ DONE`
`MapRenderer` interface and SVG backend implemented and rendering. No action.

### P0.3 — Real Commons dataset `🟡 BLOCKED (network)`

> **Goal.** Replace the placeholder fixture with a real, versioned, date-stamped dataset
> for `uk-2025-01-01`: current (post-2023 boundary review) Commons boundaries, the seat
> holders as of 2025-01-01, the party master list, and scenario snapshots (polling,
> finance, membership). Source-of-truth is committed JSON; scripts are reproducible (spec §5).
>
> **Blocker.** ONS Open Geography Portal, mySociety MapIt, and the Parliament Members API
> are outside this sandbox's network allowlist (all return 403). Run P0.3 from an
> environment with outbound access to those hosts, **or** add them to the egress allowlist
> first. `raw.githubusercontent.com` and the npm registry *are* reachable here.

**Depends on:** P0.2.

#### P0.3.1 — Fetch Commons boundaries `🟡`
**Steps:**
1. Confirm the correct ONS Open Geography Portal feature service for *Westminster
   Parliamentary Constituencies (July 2024) UK BFC* (the boundaries used at the
   4 July 2024 GE). The placeholder URL/service-ID in `scripts/data/fetch-commons-boundaries.mjs`
   is **unverified** — look it up at <https://geoportal.statistics.gov.uk> and correct it.
2. Prefer the **BFC** ("full resolution, clipped to coastline") or **BGC** ("generalised,
   clipped") layer. BGC is smaller and better for web; BFC is more accurate. Default to BGC
   unless detail is needed.
3. Run `node scripts/data/fetch-commons-boundaries.mjs`. It requests GeoJSON (`f=geojson`,
   `outSR=4326`), maps `PCON24CD`→`geometryRef` and `PCON24NM`→`name`, and writes TopoJSON
   to `src/data/scenarios/uk-2025-01-01/boundaries.commons.json`.
4. **Simplify for web.** If the output is large (> ~1–2 MB), simplify with `mapshaper`
   (e.g. `mapshaper boundaries.commons.json -simplify 10% keep-shapes -o format=topojson`).
   Add this as an npm script or a step in the fetch script. Target: a few hundred KB.
5. Sanity-check geometry by reusing the projection smoke-test pattern (load topology →
   `feature()` → `geoPath()` → assert non-empty `d` for every feature).

**Files:** modify `scripts/data/fetch-commons-boundaries.mjs`; create
`src/data/scenarios/uk-2025-01-01/boundaries.commons.json`.

**Acceptance:**
- TopoJSON has **650** geometries, each with a `geometryRef` matching a `PCON24CD` GSS code.
- Every feature projects to a non-empty SVG path.
- File committed and (if simplified) under ~1 MB.

#### P0.3.2 — Build Commons composition (seat holders @ 2025-01-01) `🟡`
**Steps:**
1. Write `scripts/data/fetch-commons-composition.mjs`. Pull current MPs from the **UK
   Parliament Members API** (`members-api.parliament.uk`) — endpoint
   `GET /api/Members/Search` / the "current Commons members" query — capturing per member:
   name, party, constituency name + GSS code, majority, and election date.
2. **Respect the as-of date.** The dataset is 2025-01-01. Reflect any by-elections **up to
   and including** that date and exclude later changes. The Members API exposes historical
   membership; filter on the membership period covering 2025-01-01.
3. **Apply party merges** (spec §4.3) during transform: map `Labour Co-operative` → `labour`,
   `Scottish Greens` / `Green Party of England & Wales` → `green`. Keep the original party
   in a sidecar field if useful for audit, but the `Seat.party` must be the merged `PartyId`.
4. Emit `Region[]` for the `commons` tier in the exact shape of `src/types/region.ts`
   (`id` = GSS code, `tier: "commons"`, `name`, `geometryRef` = GSS code, `seats: [{ regionId,
   party, memberName, majority, voteShare?, electedAt }]`).

**Files:** create `scripts/data/fetch-commons-composition.mjs`; output feeds P0.3.4.

**Acceptance:**
- Exactly **650** regions, each with exactly one seat.
- Every `seats[].party` is a valid `PartyId` from the party master list (P0.3.3).
- Every `geometryRef` matches a boundary `geometryRef` from P0.3.1 (no orphans either way).
- Speaker and any independents are represented (use a sentinel party id, e.g. `speaker`,
  `independent`).

#### P0.3.3 — Party master list `🟡`
**Steps:**
1. Create `scripts/data/build-parties.mjs` (or hand-author + validate) producing `Party[]`
   per `src/types/party.ts`.
2. For each party set: `id` (stable slug), `name`, `shortName`, `colours.primary/secondary`,
   `scope` (`national` for Lab/Con/LD/Reform/Green; `regional` for SNP/Plaid/NI parties),
   `leadership` (leader at 2025-01-01, date-stamped), `mergedFrom` where applicable.
3. **Compute `colours.onPrimary` for WCAG.** For each `primary`, pick black or white text to
   hit **contrast ratio ≥ 4.5:1** (spec §7.2). Implement the WCAG relative-luminance formula
   in the build script and **assert** the ratio; fail the build if a card colour can't meet
   4.5:1 (then choose a `secondary` or adjusted shade).
4. Leave `stances` empty for now — it's filled in P1.11.x (manifesto scoring), not Phase 0.

**Files:** create `scripts/data/build-parties.mjs`; output feeds P0.3.4.

**Acceptance:**
- Every national party that holds ≥1 Commons seat is present; every `PartyId` referenced by
  composition (P0.3.2) exists here.
- Every `onPrimary` passes contrast ≥ 4.5:1 against its `primary` (assertion in the script).
- Merges recorded via `mergedFrom`.

#### P0.3.4 — Assemble the scenario snapshot `🟡`
**Steps:**
1. Create `scripts/data/build-scenario.mjs` that composes the outputs of P0.3.1–3 into one
   `Scenario` object (`src/types/scenario.ts`) written to
   `src/data/scenarios/uk-2025-01-01/scenario.json` (replacing `composition.placeholder.json`
   as the runtime source).
2. **Polling:** snapshot headline voting-intention % per party at ~2025-01-01 from a public
   aggregate (e.g. Wikipedia "Opinion polling for the next UK general election"). Record the
   source/as-of date in a comment or sibling `sources.json`.
3. **Finance:** populate `PartyFinance` with `source: 'estimated'` where figures aren't
   directly reported; never present an estimate as reported (spec §4.2 provenance note).
4. **Membership:** latest published figures; flag estimates.
5. Keep `boundaries.commons.json` separate from `scenario.json` (boundaries are large and
   change rarely; scenario state is small and per-date).

**Files:** create `scripts/data/build-scenario.mjs`,
`src/data/scenarios/uk-2025-01-01/scenario.json` (and optional `sources.json`).

**Acceptance:**
- `scenario.json` validates against the `Scenario` type (see P0.3.5).
- `polling` sums to a sensible total (≤ 100; "Others" handled explicitly).
- Every estimated value carries `source: 'estimated'`.

#### P0.3.5 — Validation + CI guard `🟡 (validation 🔲 doable now)`
**Steps:**
1. Add a `scripts/data/validate-scenario.mjs` that loads the dataset and asserts:
   - seat counts reconcile to known totals (Commons **650**; later tiers 129/60/90/…);
   - every `Seat.party` resolves to a `Party`;
   - every `Region.geometryRef` resolves to a boundary geometry and vice-versa;
   - WCAG contrast holds for every party card colour;
   - no `NaN`/missing required fields; dates are valid ISO.
2. Wire it as `npm run validate:data` and (optionally) a CI workflow + a `pretest`/`prebuild`
   hook so bad data can't ship.
3. **This validator can and should be written now against the placeholder data** (it's not
   network-blocked) so it's ready the moment real data lands. Mark it `🔲` not `🟡`.

**Files:** create `scripts/data/validate-scenario.mjs`; add npm script; optional
`.github/workflows/data.yml`.

**Acceptance:** `npm run validate:data` exits 0 on good data and non-zero (with a clear
message) when any invariant is violated; passes against placeholder data today.

#### P0.3.6 — Point the store at real data `🟡`
**Steps:**
1. Update `src/stores/scenario.ts` to import `scenario.json` + `boundaries.commons.json`
   instead of the `*.placeholder.json` files, **once they exist**.
2. Keep the placeholder files in-repo (or move under a `__fixtures__` path) for tests.
3. Update `MapView.vue`'s `objectKey` if the real topology uses a different object name than
   `"regions"` (the fetch script controls this — keep it `"regions"` to avoid churn).

**Files:** modify `src/stores/scenario.ts` (and possibly `MapView.vue`).

**Acceptance:** `npm run dev` renders the **real** 650-seat Commons map, coloured by holding
party, with correct hover stats; `npm run build` clean.

---

## 3. Phase 1 — MVP playable shell

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

**Depends on:** P0.1.

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

**Depends on:** P1.0, P0.2 (`scenario` store exists).

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

**Depends on:** P1.0, P1.1, P0.2.

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
   at-a-glance extras (devolved seats, headline polling %); difficulty badge (P1.2.3).
4. Style the card **in the party's colours** using `colours.primary` as background and
   `colours.onPrimary` as text (already WCAG-verified at data-build time, P0.3.3). Pull every
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

**Files (P1.2):** `src/screens/StartScreen.vue`, `src/components/PartyCard.vue`,
`src/components/DifficultyBadge.vue`, `src/sim/difficulty.ts`.

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

**Depends on:** P1.4, P0.2 (and ideally P0.3 for real geometry).

**Steps:**
1. Reuse `MapView.vue`; mount it in the centre slot of `GameScreen`.
2. Add **zoom + pan** (wheel-zoom + drag-pan). Implement at the component/CSS level (transform)
   or via a `d3-zoom` integration inside `SvgMapRenderer` — keep zoom state out of game logic.
3. Hover tooltip already shows MP/party/majority; extend to vote share when present.
4. Region fill comes from current holding party colour (already wired); ensure it reads live
   composition from the store, not the placeholder constant, once P0.3 lands.
**Acceptance:** Map fills centre, zoom/pan works, hover shows real stats, colours match holders;
faux-3D treatment retained.

### P1.6 — Hemicycle (party-makeup dots) `🔲`
**Goal.** Spec §9.2: dot diagram of seat composition for the current view's tier.

**Depends on:** P1.4, P0.2.

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

**Depends on:** P1.1, P0.2.

**Steps:**
1. Create `src/components/PartyPanel.vue`. Show, for the **player's** party:
   - party name; current polling % (0 dp);
   - **two seat figures** — Commons (prominent) and a combined "everything else" elected total
     (smaller); **Lords shown separately**, never in the combined total (spec §9.3);
   - party finance (estimated; flagged); membership;
   - confirmed extras: leader approval rating, vote-share **trend arrow** (momentum), councils
     controlled, days since last election.
2. All values from `game`/`scenario` stores. For MVP, tiers beyond Commons may be 0/"—" with a
   footnote until Phase 2 data exists — but the **layout** must already accommodate them.
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

#### P1.11.1 — Policy axes + types
**Steps:** In `src/sim/axes.ts`, define the fixed axis list (spec §10.5.1: immigration,
environment, tax, public spending, EU/Brexit, social liberalism, law & order, devolution — this
is the still-open item in spec §13.1; **confirm the list with the product owner before scoring
manifestos**, but the engine can be built against a provisional list). Types: `AxisId`,
`Stance = { value: -1..1, source }` (already in `Party.stances`), `Salience = Record<AxisId,
number>`.
**Acceptance:** Axis list centralised; `Party.stances` keyed by these axes; types compile.

#### P1.11.2 — Voter segments + party base
**Steps:** In `src/sim/segments.ts`, define voter segments scored on the same axes, each with a
size weight, plus per-party **core base** definitions. For MVP these can be a small hand-authored
set in `src/data/sim/segments.json` (flagged as tunable/estimated). Structure for later
data-driven refinement.
**Acceptance:** Segments + bases load from data; sum of segment weights normalised.

#### P1.11.3 — Polling update function
**Steps:** In `src/sim/poll.ts`, implement: `polling = f(alignment(party, segment) weighted by
salience) − baseBetrayalPenalty(party movement vs core base)` (spec §10.5.1 step 5). Pure,
deterministic, synchronous, client-side. Normalise outputs so the field sums sensibly.
**Acceptance:** Pure function; given identical inputs returns identical outputs; no randomness in
the core path (any procedural variety must be seeded/deterministic).

#### P1.11.4 — Validate against the spec's worked examples
**Steps:** Add unit tests reproducing spec §10.5.2: (a) immigration salience → ~0 ⇒ Reform dips;
(b) governing party occupies green space ⇒ Greens squeezed; (c) Greens adopt anti-environment ⇒
base-betrayal collapse among their segment. Assert the **direction** of each move.
**Acceptance:** All three qualitative outcomes reproduced by tests.

**Files (P1.11):** `src/sim/{axes,segments,poll,difficulty}.ts`,
`src/data/sim/segments.json`, plus tests.

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

## 4. Cross-cutting concerns (apply throughout)

- **Testing.** Add **Vitest** early (P1.1-ish). Unit-test pure logic: `sim/poll.ts`,
  `sim/difficulty.ts`, hemicycle layout, WCAG contrast, data validation. Component tests
  optional for MVP. Add `npm run test`.
- **Accessibility.** Party-card contrast is enforced at data-build time (P0.3.3); also ensure
  interactive controls are keyboard-reachable and the map has non-colour-only affordances where
  feasible.
- **Determinism.** No `Math.random()` in the sim path — use a seeded PRNG so runs are
  reproducible and testable (spec §10.5 rationale).
- **Performance.** Simplify boundaries for web (P0.3.1); keep the hemicycle and map re-renders
  cheap (the clock ticks every 15s, but action handling shouldn't thrash). Profile if the map
  redraws fully on every tick — diff/patch fills rather than rebuilding paths if needed.
- **Data provenance.** Anything estimated carries `source: 'estimated'` and is footnoted in UI
  (spec §4.2). Never present a guess as reported fact.
- **No scope creep into Phase 2.** Devolved/London/council views, hex-map renderer, full event
  library + authoring tools, clickable hemicycle drill-down, expandable clock/menus, deeper
  Democracy-style menus/charts, and additional scenarios are **Phase 2+** (spec §12) — stub their
  seams, don't build them.

---

## A. Dependency graph & suggested execution order

```
P0.1 ✅ ─┬─ P0.2 ✅ ─┬─ P0.3 (real data, BLOCKED) ─────────────┐
         │           │                                         │
         │           └─ P0.3.5 validator (doable now) ─────────┤
         │                                                     │
         └─ P1.0 app shell ─ P1.1 game stores ─┬─ P1.2 start menu ─ P1.2.3 difficulty
                                               ├─ P1.3 loading
                                               ├─ P1.4 game layout ─┬─ P1.5 map ◄── P0.3
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

**Do-now-despite-the-blocker:** P0.3.5 (validator) and all of P1.0–P1.12 can be built against
the **placeholder dataset**; only P1.5's *real* geometry and the final polish in P0.3.6 wait on
network access for P0.3.1–4.

---

## B. Decisions to confirm with the product owner

These are flagged open in spec §13 and gate specific tasks (not the whole plan):
1. **Policy-axis list** (gates P1.11.1 manifesto scoring) — confirm the eight-ish axes before
   hand-scoring manifestos.
2. **Event schema** (gates P1.12.1) — confirm the proposed format before authoring a library.
3. **Party-finance estimates** — confirm "estimate-with-footnote" is acceptable for finance
   figures that aren't publicly reported.
4. **Working title** — "Politics UK" is the placeholder; confirm or change.
```
