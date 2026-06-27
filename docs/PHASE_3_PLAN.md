# Politics UK — Phase 3 Work Breakdown

> **Purpose.** Phase 3 makes Politics UK a durable, replayable campaign game. It assumes P2.8
> (the election/by-election surface) and P2.9 (the expanded party-management surface) are complete.
> The work deliberately begins with persistence and game lifecycle: decisions, generated contests,
> and campaign resources must survive a browser restart before the game adds another layer of depth.
>
> The authoritative design remains [`GAME_SPEC.md`](./GAME_SPEC.md). This plan converts the
> next set of product decisions into small, independently implementable contracts. It does not
> silently expand Phase 2; any unfinished Phase 2 task remains Phase 2 work.

## 0. How to use this document

The conventions, status legend, and definition of done are the same as
[`PHASE_2_PLAN.md`](./PHASE_2_PLAN.md). Every task below has a dedicated brief in `phase3/`.

Phase 3's additional definition of done:

1. A save made before a browser refresh can be restored into an equivalent playable state; save
   files must be versioned and validated before use.
2. New player actions flow through typed domain/store APIs. Components may request an action, but
   they must not directly alter finance, polling, seats, or persistent state.
3. Simulation paths remain deterministic for a given scenario, save state, and seed. Tests must
   cover the pure logic; deterministic integration/replay tests cover the important seams.
4. New interactive UI works with keyboard navigation, visible focus, and reduced-motion settings.
5. `npm run build`, `npm test`, and `npm run validate:data` pass. Add a dedicated persistence or
   replay command only if it adds coverage that those commands cannot express.

## 1. Phase 3 — persistence, strategy, elections, and polish

### P3.0 — Versioned save-game contract and persistence repository `✅ DONE`

See
[`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p30--versioned-save-game-contract-and-persistence-repository-)
for the full record of what was built.

### P3.1 — Autosave, manual slots, and portable saves `✅ DONE`

See
[`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p31--autosave-manual-slots-and-portable-saves)
for the full record of what was built.

### P3.2 — Main menu, load/new-game flow, and safe game lifecycle `✅ DONE`

See
[`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p32--main-menu-loadnew-game-flow-and-safe-game-lifecycle)
for the full record of what was built.

### P3.3 — Campaign action economy `✅ DONE`

See
[`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p33--campaign-action-economy-)
for the full record of what was built.

### P3.4 — Targeted campaigning and opponent strategy `✅ DONE`

See [`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p34--targeted-campaigning-and-opponent-strategy-)
for the full record of what was built.

### P3.5 — Election resolution and changing political world state `DONE`

See
[PHASE_3_COMPLETED.md](./PHASE_3_COMPLETED.md#p35--election-resolution-and-changing-political-world-state)
for the full record of what was built.

### P3.6 — Campaign objectives, scenario arcs, and replayable content `DONE`

See
[`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p36---campaign-objectives-scenario-arcs-and-replayable-content-done)
for the full record of what was built.

### P3.7 — Onboarding and simulation explainability `DONE`

See
[`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p37---onboarding-and-simulation-explainability-done)
for the full record of what was built.

### P3.8 — Player controls, accessibility, and responsive play `DONE`

See
[`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p38---player-controls-accessibility-and-responsive-play-done)
for the full record of what was built.

### P3.9 — Balance, deterministic regression, and performance hardening `DONE`

See
[`PHASE_3_COMPLETED.md`](./PHASE_3_COMPLETED.md#p39---balance-deterministic-regression-and-performance-hardening-done)
for the full record of what was built.

## 2. Scope and ordering

P3.0—P3.2 are one vertical slice and should land first. A menu that says “Continue” must not
appear until its saved state is trustworthy. P3.3—P3.5 make the campaign strategically meaningful:
choices consume scarce resources, can be targeted, and ultimately change the political world.
P3.6—P3.9 turn that system into a legible, replayable, and robust game rather than a collection
of mechanics.

```
P2.8 elections / P2.9 party levers
          │
          ├── P3.0 save contract ── P3.1 autosave/slots ── P3.2 load/new-game lifecycle
          │                                  │
          ├── P3.3 action economy ──────────┼── P3.4 targeting + opponent AI ── P3.5 elections
          │                                  │                                      │
          ├── P2.6 event library + P2.10 scenarios ─────────────── P3.6 campaign content
          │                                                          │
          └── P3.7 onboarding / P3.8 accessibility / P3.9 quality ─┴── continuous across Phase 3
```

**Suggested delivery order:** P3.0 → P3.1 → P3.2 → P3.3 → P3.4 → P3.5 → P3.6. P3.7 and P3.8
should begin once the corresponding UI exists, not be held until the end. P3.9 begins with the
first persistence merge and continues throughout.

## 3. Cross-cutting decisions

- **Local-first saves.** The initial game is single-player and has no account system. Use browser
  storage (IndexedDB) behind a repository interface; do not add a backend merely to persist a
  campaign. Import/export is the safe bridge between browsers.
- **Scenario data is immutable.** A save references a scenario id and stores only mutable,
  playthrough-specific overlay state. Do not duplicate boundaries or raw scenario JSON into every
  save slot.
- **No opaque persistence.** Pinia persistence plugins may be evaluated, but the final write path
  must use an explicit, tested projection and hydration layer. Directly serialising whole stores
  couples old saves to component/UI internals.
- **One action pipeline.** Event choices, P2.8 contest actions, P2.9 party levers, opponent moves,
  and election outcomes must each produce typed records. This makes autosaves, feeds, replays,
  balancing, and “why did this happen?” explanations possible.
- **Privacy by default.** No analytics or outbound telemetry is required for balance work. Any
  diagnostic export must be opt-in, human-readable, and local unless a later product decision says
  otherwise.
- **Avoid premature online/cloud/multiplayer work.** They need identity, conflict resolution,
  security, and product policy. The repository boundary keeps that option open without making it a
  Phase 3 dependency.

## 4. Explicitly deferred beyond Phase 3

- User accounts, cloud sync, multiplayer, and public leaderboards.
- Procedural scenario generation beyond author-controlled scenario/event data.
- A real-time LLM in the simulation path.
- Real 3D/Tres rendering unless a measured usability or performance need justifies it.
- Mod/plugin APIs. Authoring tools and validated data formats are sufficient foundations for now.
