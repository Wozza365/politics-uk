# Politics UK — Game Specification (Draft v0.2)

> **Status:** Living draft. Sections marked _(MVP)_ are the first build target; _(Later)_ items
> are captured now so the architecture leaves room for them but are out of scope for the first
> playable build. Open questions are collected in [§13](#13-open-questions).

---

## 1. Vision

A single-player political simulator set on a map of the United Kingdom. The player takes control
of a real UK political party at a fixed point in history (the first **Scenario** is **1 January
2025**) and attempts to win elections — primarily a UK General Election, with each party having an
appropriate **win condition** (see [§11](#11-difficulty--win-conditions)).

The game presents the country as an interactive map with multiple **views** (Westminster, the
devolved parliaments, councils, etc.), a daily-ticking **game clock** that generates **events**, and
a **feed** of those events and the player's responses. The aesthetic and UI density take inspiration
from _Democracy 3_ — many panels, charts, and drill-down menus — but built entirely on the web.

---

## 2. Tech stack (decided)

Recap of the platform decisions already agreed, for reference:

| Concern | Choice |
| --- | --- |
| Build / dev server | **Vite** |
| Language | **TypeScript** |
| UI framework | **Vue 3** (`<script setup>`, Composition API) |
| State | **Pinia** |
| Styling | **Tailwind CSS** |
| Map geometry / projection | **d3-geo** + **topojson-client** |
| Map rendering | **SVG** (canvas fallback per-view if perf demands) |
| "3D" map look | **CSS** (isometric transform + extruded edge + `drop-shadow`) |
| Genuine 3D _(Later, optional)_ | **TresJS** (`@tresjs/core`) behind the renderer interface |

**Proposed additions** (see [§10](#10-ui--component-libraries)):

- **Charts:** `vue-echarts` (Apache ECharts) for dashboard charts; raw **d3** for bespoke dataviz.
- **UI primitives:** **Reka UI** (headless) + Tailwind for a fully custom, skinnable look — chosen
  over a batteries-included kit (e.g. PrimeVue) to match the distinctive _Democracy 3_ aesthetic.
- **Animation / polish:** `@vueuse/core` and `@vueuse/motion` (or GSAP if we need timeline control).

---

## 3. Core concepts & glossary

| Term | Meaning |
| --- | --- |
| **Scenario** | A complete starting world state at a fixed date (parties, all seats/representation, polling, finances). First scenario: `2025-01-01`. Also the unit players "win". |
| **Party** | A political organisation. Has identity (name, colours, logo), leadership, and representation across tiers. Every party is selectable as a scenario _except local/independent parties_. |
| **Tier** | A level of UK governance (Commons, Lords, Holyrood, councils…). See [§4](#4-the-uk-political-data-model). |
| **View** | A way of rendering the map + hemicycle for one tier or grouping (e.g. "Westminster", "Scottish Parliament", "Local councils"). |
| **Region / Unit** | One addressable area in a tier — a constituency, ward, council, etc. Holds real representation data. |
| **Seat** | One elected position within a region. |
| **Game clock** | The simulated date, ticking daily, driving event generation and election countdowns. |
| **Event** | Something that happens on a date (real or fictional, local→international). May require player **action**. |
| **Action** | A player decision in response to an event; pauses the clock until resolved. |
| **Feed** | The chronological log of events and actions on the left of the game screen. |

---

## 4. The UK political data model

The game models UK governance as a set of **tiers**, each containing **units** (regions), each with
**seats** held by **parties**. This is the spine of the whole game.

### 4.1 Tiers (full scope, with data-availability priority)

**All tiers below are in scope** (parish councils are explicitly cut — see note). The **Phase**
column shows when a tier's _map view_ ships, not whether it's included: Phase 1 renders Westminster
first; every other tier is built into the data model and gets its view in Phase 2+.

| # | Tier | Units (≈ count, Jan 2025) | Seats | Phase | Data difficulty |
| --- | --- | --- | --- | --- | --- |
| 1 | **House of Commons** | 650 constituencies (2024 boundaries) | 650 MPs | **P1** | Easy |
| 2 | **House of Lords** | n/a (chamber) | ~800 peers by party group | **P1** (stats only) | Easy |
| 3 | **Scottish Parliament** | 73 constituencies + 8 regions (56 list) | 129 MSPs | P2 | Easy |
| 4 | **Senedd (Wales)** | 40 constituencies + 5 regions (20 list)¹ | 60 MS | P2 | Easy |
| 5 | **NI Assembly** | 18 constituencies (5 each) | 90 MLAs | P2 | Easy |
| 6 | **London Assembly** | 14 constituencies + London-wide list | 25 AMs | P2 | Easy |
| 7 | **Combined-authority / metro mayors** | ~12 mayoralties | 1 each | P2 | Easy |
| 8 | **Directly elected local mayors** | ~15 | 1 each | P2 | Medium |
| 9 | **Police & Crime Commissioners** | ~37 (Eng & Wales) | 1 each | P2 | Easy |
| 10 | **County councils** | ~21 | wards | P2 | Medium |
| 11 | **District / borough councils** | ~164 | wards | P2 | Medium |
| 12 | **Unitary authorities** (e.g. Derby City, Thurrock) | ~62 | wards | P2 | Medium |
| 13 | **Metropolitan boroughs** | 36 | wards | P2 | Medium |
| 14 | **London boroughs** | 32 (+ City of London) | wards | P2 | Medium |
| 15 | **Scottish councils** | 32 | wards | P2 | Medium |
| 16 | **Welsh councils** | 22 | wards | P2 | Medium |
| 17 | **NI councils** | 11 | wards | P2 | Medium |
| — | ~~Parish / town / community councils~~ | ~10,000+ | — | **CUT** | Hard / mostly non-partisan |

¹ The Senedd expands to 96 members across 16 constituencies from the 2026 election. On the
`2025-01-01` scenario date it is still **60 members** under the old system — the data model must be
**date-correct**, not "current".

> **Decision — parish councils cut.** Local government is limited to **principal authorities**
> (tiers 10–17): county, district/borough, unitary, metropolitan, London boroughs, and
> Scottish/Welsh/NI councils. Parishes (~10k bodies) are dropped — their data is sparse and their
> councillors are mostly non-partisan, so they'd add data cost without party-political gameplay.
> Revisit-able later. Tiers 1–9 are very achievable from open data; tiers 10–17 are well covered by
> Open Council Data. See [§5](#5-data-acquisition-plan).

### 4.2 Entity shapes (illustrative TypeScript — not final)

```ts
type PartyId = string;          // stable slug, e.g. "labour", "snp"
type TierId = string;           // "commons", "holyrood", "senedd", "council:metropolitan", …
type ISODate = string;          // "2025-01-01"

interface Party {
  id: PartyId;
  name: string;
  shortName: string;            // "Lab", "Con", "LD"
  colours: { primary: string; secondary?: string; onPrimary: string }; // onPrimary = WCAG-safe text
  logo?: string;                // asset path; placeholder for now
  scope: 'national' | 'regional' | 'local';   // regional = SNP/PC/NI parties; local excluded from selector
  leadership: PartyOfficer[];   // leader, deputy, etc. (date-stamped)
  founded?: number;
}

interface PartyOfficer {
  role: 'leader' | 'deputy_leader' | 'chair' | 'chief_whip' | string;
  personName: string;
  since?: ISODate;
  portrait?: string;            // placeholder image with name for now
}

interface Region {                // one unit within a tier
  id: string;                     // ONS/GSS code where available, e.g. "E14001305"
  tier: TierId;
  name: string;
  geometryRef: string;            // key into the boundary topojson for this tier
  seats: Seat[];
}

interface Seat {
  regionId: string;
  party: PartyId;                 // current holder
  memberName?: string;
  majority?: number;              // votes; for Commons hover stats
  voteShare?: number;             // % at last relevant election
  electedAt?: ISODate;
}

interface Scenario {
  id: string;                     // "uk-2025-01-01"
  date: ISODate;
  label: string;
  tiers: Record<TierId, Region[]>;
  parties: Party[];
  polling: Record<PartyId, number>;   // headline VI %, scenario-start snapshot
  finances: Record<PartyId, PartyFinance>;
  membership: Record<PartyId, number>;
}

interface PartyFinance {
  estimatedCashOnHand?: number;   // £, may be estimated — flag provenance
  annualIncome?: number;
  source: 'reported' | 'estimated';
}
```

> **Provenance matters.** Where a value is estimated (finance, membership, council aggregates), the
> data carries a `source`/`estimated` flag so the UI can footnote it and we never present a guess as
> fact.

---

## 5. Data acquisition plan

A standalone workstream. Goal: build versioned, date-stamped JSON datasets under `src/data/scenarios/uk-2025-01-01/`,
generated by scripts in `scripts/data/` so they are reproducible and auditable.

### 5.1 Candidate sources

| Data | Primary sources |
| --- | --- |
| Commons members, majorities, by-elections | UK Parliament Members API, House of Commons Library, Democracy Club |
| Boundaries (all tiers) | **ONS Open Geography Portal**, mySociety **MapIt** |
| Devolved parliaments composition | Each parliament's open data; Wikipedia snapshots |
| Lords composition by group | UK Parliament data |
| Council composition | **Open Council Data UK** (opencouncildata.co.uk), Wikipedia |
| Mayors / PCCs | Electoral Commission, Wikipedia |
| Party leadership / structure | Party sites, Wikipedia (date-stamped) |
| Hex cartogram layout | House of Commons Library / **Open Innovations** constituency hexmaps |
| Polling (VI snapshot) | Wikipedia "Opinion polling for the next UK general election", Politico/PollBase aggregates |

### 5.2 Approach

1. **Boundaries first** — fetch TopoJSON for Commons + devolved tiers, simplify for web (mapshaper),
   key by GSS code.
2. **Composition** — load seat holders per tier as of `2025-01-01` (respecting by-elections up to that date).
3. **Party master list** — identity, colours (verified for contrast), leadership.
4. **Scenario-level snapshots** — polling, finance (flagged estimates), membership.
5. **Validation** — seat counts must reconcile to known totals (650, 129, 60, 90, …); CI check.

> ⚠️ **Network note:** depending on the session's network policy, live fetching may be restricted.
> The acquisition scripts are designed to be re-runnable wherever access exists; committed JSON is
> the source of truth for the game at runtime.

---

## 6. Screens overview

```
┌───────────────────────┐     ┌────────────┐     ┌───────────────────────────────┐
│  Start menu           │ →   │  Loading   │ →   │  Game screen                  │
│  (timeline + party)   │     │  (spinner) │     │  (map, feed, clock, stats…)   │
└───────────────────────┘     └────────────┘     └───────────────────────────────┘
```

---

## 7. Start menu _(MVP)_

### 7.1 Timeline selector
- A **slider** for choosing the scenario date.
- For now **locked to a single stop: `2025-01-01`** (slider is present but has one selectable
  position; architected for more stops later).

### 7.2 Party selector
- A row/grid of **party cards**, one per **selectable** party. For now, **only national parties are
  selectable** (`scope: 'national'` — Lab, Con, LD, Reform, Green E&W, …). **Regional parties**
  (SNP, Plaid Cymru, NI parties) and **local/independent** parties are **excluded from the picker**.
  - Regional parties remain fully in the data model and still render on the map/hemicycle as
    seat-holders in their party colours — they're just not playable yet. (Making them playable later
    reopens the regional win-condition question in [§11.2](#112-win-conditions).)
- Each card is styled **in that party's colours**, with **WCAG-checked contrasting text**
  (`onPrimary` colour; target contrast ratio ≥ 4.5:1, verified at data-build time).
- Card contents:
  - **Top:** party name.
  - **Middle:** **leader portrait** (placeholder image showing the leader's name for now).
  - **Details:** current leader, seats in Parliament, total council seats, plus other at-a-glance
    info (e.g. devolved seats, headline polling %).
  - **Difficulty** badge — derived from the party's popularity and realistic path to power, with a
    **small-party weighting** so minor-party runs are hard-but-not-impossible (see [§11](#11-difficulty--win-conditions)).
- A **Start** button begins the game with the selected party + scenario.

### 7.3 Card data (Jan 2025, indicative)
The selector will surface real figures once the dataset is built; until then cards render from the
scenario JSON so no numbers are hard-coded in components.

---

## 8. Loading screen _(MVP)_
- Simple centered **spinner** while the scenario dataset, boundaries, and derived state load.
- Placeholder copy; can show the selected party colour as a theme accent.

---

## 9. Game screen _(MVP unless noted)_

Layout (all overlaid on a neutral background; the map sits centrally):

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         [ Top-centre: party stats ]        [ clock + GE ⏱ ]│
│ ┌─────────────┐                                                            │
│ │  Event feed │              ███  3D UK MAP  ███                           │
│ │  (left,     │              (zoom + hover stats)                          │
│ │   no panel  │                                                            │
│ │   behind)   │              ░░ party-makeup dots (hemicycle) ░░           │
│ │             │                                                            │
│ └─────────────┘              [  view switcher nav bar  ]                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.1 The map (centre)
- **3D look** per the agreed CSS approach (isometric tilt + extruded edge + soft drop-shadow).
- **One view at MVP** (Westminster / Commons); other views architected but added later.
- **Zoomable** (and pan).
- **Hover a constituency →** tooltip with **real stats**: current MP's party, member name, majority,
  vote share, etc.
- **View switching** changes the tier shown. In some scenarios/views, **areas are disabled** when
  they have no representation at that level (e.g. England is greyed out in the devolved-parliament
  views). Disabled regions render muted and are non-interactive.

#### Renderer abstraction (important architectural rule)
All map drawing sits behind a `MapRenderer` interface taking `(boundarySet, regionState) → drawn map`.
MVP ships `SvgMapRenderer`. A future `TresMapRenderer` (real 3D) can replace it **for one view** with
zero changes to game logic. This is the single non-negotiable design decision.

### 9.2 Party-makeup view (hemicycle dots)
- Dot diagram (like the reference image) showing seat composition for the **current view's tier**.
- **Dot scaling / rounding:**
  - Tiers with hundreds of seats (Commons 650, Holyrood 129, …): **1 dot = 1 seat**.
  - Tiers with thousands of seats (aggregate council totals, ~18k+): **1 dot = 10 or 100**, rounded,
    with a footnote stating the scale. Scale chosen per-view to keep dot counts legible.
- Dots are **semi-interactive now** (hover-ready markup) and **clickable later** (drill into that
  party's seats / breakdown).

### 9.3 Top-centre — party panel _(MVP collapsed; expandable later)_

**Collapsed (at-a-glance) — MVP:**
- **Party name.**
- **Current polling %** (rounded to 0 dp).
- **Seats** — two figures: **Parliament (Commons)** prominent, and a **combined "everything else"**
  elected total slightly smaller. _Lords are appointed, not elected — shown separately, not in this
  combined total._
- **Party finance** (estimated; flagged).
- **Party membership.**
- **Confirmed additions:** leader approval rating, vote-share trend arrow (momentum), number of
  councils controlled, days since last election.

**Expanded (the player's levers) — _(Later)_:**
Clicking the panel expands it into the party-management surface where the player takes proactive
actions. Planned levers:
- **Fundraising** — run appeals / drives to raise party finance.
- **Social media activity** — campaigns affecting polling / membership / reach.
- **Staffing** — hiring and firing party roles/officers.
- **Policy** — set/adjust party positions.
- **Campaigning** — direct effort/spend into regions or tiers.
- **Leadership** — manage the leader and senior team.

Opening this (or any) menu **pauses the game clock** (see [§9.5](#95-game-clock--election-countdown-top-right-mvp)).
Levers are stubbed at MVP; the collapsed panel ships first.

### 9.4 Event feed (left) _(MVP)_
- A **text-style feed**, no panel/background behind it (sits directly on the backdrop).
- Each entry: **event headline in bold**, the **action taken below it** (if any), and a **simple
  date**. Newest at top (assumed — confirm ordering).
- Populated as the clock ticks and events fire.

### 9.5 Game clock & election countdown (top-right) _(MVP)_
- Visible **clock** showing the simulated date; **auto-advances one day every ~15 seconds**
  (real-time). The 15s/day cadence is a tunable constant for now; a speed/pause control comes later.
- Each tick may **generate events** (local → international; real-history-based and fictional).
- **The clock pauses when:**
  - an event fires that **requires a player response** (resume on resolution), or
  - the player **opens a menu** _(Later — e.g. the expanded party panel in [§9.3](#93-top-centre--party-panel-mvp-collapsed-expandable-later))_.
- A **countdown to the next General Election**.
- The clock UI is an **interactive element** (expandable later to list by-elections and other minor
  elections in detail) — interactivity stubbed for now.

### 9.6 View switcher (bottom-centre) _(MVP shell, one view active)_
- A single **nav bar** to switch between map/hemicycle views (Westminster, Holyrood, Senedd, NI,
  London, councils…). At MVP only Westminster is active; the bar shows the others as upcoming.

---

## 10. Event system

The simulation heartbeat.

- **Clock tick (daily, ~15s real-time):** advances date; rolls for events from a weighted pool.
  Auto-advance halts on action-events and (later) open menus, then resumes.
- **Event sources:**
  - **Real / historical** — seeded from actual events near the scenario date (so early play tracks
    reality).
  - **Fictional / procedural** — generated to keep runs varied and replayable.
- **Event scope:** local, regional, national, international.
- **Actions:** some events require a player decision. When one fires:
  - the **game clock pauses**,
  - the relevant UI area is **highlighted**,
  - the player's choice is recorded into the feed under the event.
- **Authoring:** events need a data-driven format (triggers, conditions, weighted outcomes, effects
  on polling/finance/membership/seats). A large library of both real and fictional events will be
  built over time. _Format TBD — see [§13](#13-open-questions)._

---

## 11. Difficulty & win conditions

### 11.1 Difficulty rating
A 1–5 (or 1–3 banded) badge per party on the selector, derived from:
- **Popularity proxy** — current polling % and seat share at the scenario date.
- **Realistic path to power** — can this party plausibly form a government / meet its win condition?
- **Small-party weighting** — a corrective term that **eases** very small parties so their scenarios
  are challenging but **not impossible** (capped below "impossible").

Indicative banding for Jan 2025 (to validate against real data): governing party = lower difficulty;
official opposition = medium; established third parties = hard; minor/single-issue = very hard but
weighted up; regional parties = special-cased (see below).

### 11.2 Win conditions
- **National parties** (the only playable scope for now — Lab, Con, LD, Reform, Green E&W…):
  the goal is the **next UK General Election**. _Exact bar to confirm — see [§13](#13-open-questions)_
  (plurality / largest party vs outright majority vs forming a government incl. coalition).
- **Regional parties** (SNP, Plaid Cymru, NI parties) — **not playable yet** (excluded from the
  picker, [§7.2](#72-party-selector)), so their win condition is deferred. When made playable, the
  proposed goal is **dominance of their devolved nation** (largest party / first minister), with
  optional stretch goals (e.g. an independence referendum).

---

## 12. Build phasing

### Phase 0 — Foundations
- Vite + Vue 3 + TS + Pinia + Tailwind scaffold.
- Renderer abstraction + `SvgMapRenderer`.
- Commons boundaries + 2025-01-01 composition dataset.

### Phase 1 — MVP playable shell
- Start menu (locked timeline + party cards + difficulty).
- Loading spinner.
- Game screen: Westminster 3D map (zoom + hover), hemicycle dots, top-centre stats, event feed,
  clock with GE countdown, view-switcher shell.
- Minimal event loop (a handful of seeded events with/without actions).

### Phase 2+ _(Later)_
- Additional views (devolved, London, councils) + disabled-region logic.
- Hex-map renderer.
- Full event library (real + fictional), authoring tooling.
- Clickable hemicycle dots, expandable clock/elections panel.
- Deeper Democracy-3-style menus & charts.
- More scenarios (real + custom-generated).

---

## 13. Open questions

Grouped by impact. None block starting Phase 0, but answers shape Phase 1.

**Resolved (kept for the record)**
- ✅ **Turn feel** — daily auto-advance at ~15s/day; pause on action-events (and, later, open menus).
- ✅ **Player levers** — expanded party panel: fundraising, social media, hiring/firing, policy,
  campaigning, leadership.
- ✅ **Top-centre extras** — leader approval, momentum arrow, councils controlled, days-to-election: in.
- ✅ **Regional-party win conditions** — deferred; regional parties not playable for now.
- ✅ **Parish councils** — cut; local = principal authorities only.

**Still open — highest impact**
1. **National-party win bar** — what counts as "winning" the GE: **plurality** (largest party),
   **outright majority** (326+), or **forming a government** (incl. coalition)? Shapes the win check.

**Medium impact**
2. **Feed ordering** — newest-first (my assumption) or chronological?
3. **Difficulty scale** — 3 bands (Easy/Medium/Hard) or 5? And hand-tune Jan-2025 ratings or derive
   purely by formula?
4. **Polling model** — headline % static for now, or drifting with events from day one? (Given the
   15s clock + events, I lean **drift from day one**.)

**Lower impact / later**
5. **Event format** — happy for me to design the event schema, or do you have a structure in mind?
6. **Party finance** — acceptable to show estimates with a footnote where real figures are absent?
7. **Working title** — "Politics UK" is a placeholder; any preferred name?

---

_End of draft v0.1._
