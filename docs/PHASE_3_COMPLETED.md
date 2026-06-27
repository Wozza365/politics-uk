# Phase 3 — completed task record

Each entry below is the full record of what was built for a task marked `✅ DONE` in
[`PHASE_3_PLAN.md`](./PHASE_3_PLAN.md). Read the entry for a task you're extending, not the whole
file.

## P3.0 — Versioned save-game contract and persistence repository ✅

- `src/types/save.ts` (new) — `SaveKind`, `CURRENT_SAVE_FORMAT_VERSION`/`SaveFormatVersion`,
  `SaveMetadata` (id, scenario id, kind, timestamps, optional label, `playthroughSeed`),
  `GameSaveStateV1` (every mutable `game` store field worth persisting — polling/history, pending
  poll impacts, finance/membership, lever cooldowns, feed, P2.8 contests, fired/pending event ids,
  salience, result), `UiSaveStateV1` (display prefs only, typed as plain `string` at the contract
  boundary since the real unions live in `stores/ui.ts`/`stores/scenario.ts` and validating/
  narrowing them is the hydration step's job, not the type's), `SaveGameV1`, `SaveSummary` (load-
  screen projection), and a narrow `SaveValidationError` (`type` + `message`, never a thrown
  exception). `pendingEvents` are saved as ids only — they're straight out of the authored
  `EVENT_POOL`, so duplicating their content into every save would violate "static data isn't
  authoritative save data."
- `src/save/codec.ts` (new) — pure, store-free parse/validate/migrate functions: `parseSaveGameJson`
  (untrusted string -> `unknown`, catches `JSON.parse` errors as `invalid-json`),
  `decodeSaveEnvelope` (shape/version validation + the no-op migration scaffold a future v2 would
  hook into — checks every required field's type by hand, no schema library in this codebase),
  `decodeSaveGame` (adds the scenario-id check on top, used before hydrating), `encodeSaveGame`,
  `summariseSaveGame`. Future-version saves are rejected (`unsupported-version`) rather than guessed
  at; deeply malformed input never throws, only returns a typed error.
- `src/save/repository.ts` (new) — the `SaveRepository` interface (`list`/`read`/`write`/`remove`/
  `clearAutosave`) plus `InMemorySaveRepository`, the implementation the test suite exercises.
  `read()` returns whatever was actually in storage (`unknown`) since storage can hold a corrupt or
  obsolete record — callers run it through `codec.ts` before trusting it; `write()` takes an
  already-valid `SaveGameV1`.
- `src/save/indexedDbRepository.ts` (new) — `IndexedDbSaveRepository`, a direct adapter onto the
  same interface using one object store (`politics-uk-saves` / `saves`, keyed by `id`). Not unit-
  tested directly (no `indexedDB` global in Vitest's Node environment, and the task contract
  explicitly calls for the in-memory repository to carry that weight); exercised once a UI is wired
  up to `stores/save.ts` in P3.1.
- `src/stores/game.ts` — new `playthroughSeed` state (drawn once per playthrough in `startGame` via
  `crypto.getRandomValues`, not the seeded `mulberry32` sim PRNG — it's session entropy, not a sim
  calculation; reserved for future sequential-randomness systems since the current sim keys
  everything off `date`/id strings instead), `toSaveState()`/`hydrateFromSaveState()` actions.
  Hydration validates every referenced party id (polling/finance/membership/pendingPollImpacts/
  leverCooldowns/selectedPartyId) and contest region id against the *live* scenario, dropping
  anything unrecognised rather than crashing; `pendingEventIds` are looked back up against
  `sim/events.ts`'s `EVENT_POOL`, dropping any id no longer present; the clock always comes back
  paused (`running: false`) regardless of what was saved.
- `src/stores/ui.ts` — `toSaveState()`/`hydrateFromSaveState()`: saves/restores `activeView`/
  `activeCouncilLevel`/`westminsterRenderer` only, each validated against its known value set with a
  safe fallback to the default; `openMenus`/`byElectionsPanelOpen`/`mapFocusRequest` are always
  reset on hydrate, per the task contract's "never an open modal or a running timer."
- `src/stores/save.ts` (new) — `useSaveStore`, the narrow coordinator: owns the live
  `SaveRepository` instance (`IndexedDbSaveRepository` by default, swappable via `useRepository()`
  for tests), `saves`/`selectedSaveId`/`lastError`, and `writeSave`/`loadSave`/`removeSave`/
  `clearAutosave`/`refreshSaves` actions. `loadSave` decodes before touching any store and leaves
  the live game/other saves untouched on failure; `writeSave('autosave', ...)` always targets the
  fixed `'autosave'` record id (the rest of the autosave-slot lifecycle is P3.1's job). No component
  talks to a repository or IndexedDB directly.
- **Scoped deliberately narrow:** no load/autosave UI — that's P3.1/P3.2; `useSaveStore` isn't
  wired into `App.vue` or any component yet.
- Covered by 19 new tests: `src/save/codec.spec.ts` (parse/decode round trip, unsupported version,
  unknown scenario, invalid envelope, corrupt state, garbage input never throws, summary
  projection), `src/save/repository.spec.ts` (write/read/replace/list-ordering/corrupt-record-
  skipping/remove/clearAutosave against `InMemorySaveRepository`), `src/stores/save.spec.ts`
  (serialise → write → fresh stores → load equivalence across a representative event/lever/contest
  playthrough; deterministic continuation after restore; corrupt/unknown-scenario/future-version
  rejection without touching the live game or a good save; `clearAutosave` scoping), and a P3.0
  block in `src/stores/game.spec.ts` (`toSaveState`/`hydrateFromSaveState` round trip; dropping a
  contest/polling/finance/membership/selectedPartyId/pendingEventId that reference an id the current
  scenario no longer recognises).
- **Acceptance:** an automated test (`src/stores/save.spec.ts`) starts a game, applies
  representative event/lever/contest changes, writes a save, creates fresh stores, restores the
  save, and observes the same playable domain state (`toSaveState()` equality) plus deterministic
  continuation on the next tick. Corrupt/obsolete/future-version/unknown-scenario records are
  rejected via a recoverable `SaveValidationError` without crashing the app or touching the live
  game or any other save. The restored game's clock is always paused until the player explicitly
  resumes it. `npm run build` and the full test suite are clean.

## P3.1 — Autosave, manual slots, and portable saves ✅

- `src/save/autosave.ts` (new) — `AutosaveScheduler`, a pure, store-free class: `schedule()`
  debounces a burst of trigger actions into one `write()`; `flush()` cancels the pending debounce
  and writes immediately (the player-facing "save now" escape hatch, and what the page-visibility
  seam below calls); a write already in flight is never overlapped — a `schedule()`/`flush()` that
  arrives mid-write sets `rerunRequested` and queues exactly one more pass once the in-flight write
  settles, so the latest state always ends up persisted. Reports `'idle' | 'pending' | 'saving' |
  'saved' | 'error'` through `onStatusChange`, never claiming success before `write()` resolves.
  `BrowserLifecycleSeam` abstracts `document`'s `visibilitychange`/`pagehide` behind
  `addListener(handler)` so it's testable with a fake seam; the real `documentLifecycleSeam` guards
  on `typeof document === 'undefined'` so the module is safe to import under Vitest's plain Node
  test environment (no jsdom in this project). Covered by 8 tests in `src/save/autosave.spec.ts`
  (coalescing, status sequencing, failed-write recovery, flush cancelling/no-op behaviour, the
  in-flight rerun queue, seam-triggered flush, and `dispose()`).
- `src/types/save.ts`/`src/save/codec.ts`/`src/save/repository.ts`/`src/save/indexedDbRepository.ts`
  — added an optional `summary?: string` field to `SaveMetadata`/`SaveSummary` (thumbnail-free
  one-line polling/cash summary, computed once at write time and never recomputed live — the
  "immutable manual-slot metadata" requirement) and threaded it through validation/decoding/
  metadata projection. Additive and backward-compatible — no format-version bump.
- `src/stores/save.ts` — rewritten around the scheduler: `startAutosave()` (idempotent — a second
  call is a no-op) wires `AutosaveScheduler` to the game store's completed domain actions via a
  detached `$onAction` hook scoped to a fixed `AUTOSAVE_TRIGGER_ACTIONS` set (`tickDay`,
  `resolveFeedAction`, `actionContest`, `runFundraisingAppeal`, `runSocialMediaCampaign`,
  `continuePlaying`) and to the page-visibility seam; `saving`/`lastSavedAt`/`lastWriteError` state
  mirrors the scheduler's status for the UI. New commands: `saveNow` (flushes the scheduler, or
  writes directly if it hasn't started yet), `createManualSave`, `overwriteManualSave` (refuses a
  target whose `kind !== 'manual'` — covers both "no such id" and "that id is the live autosave
  slot"), `renameManualSave` (label only, save state untouched), `deleteSave` (renamed from
  `removeSave`), `exportSave` (JSON text, no DOM access — `useSaveManagement.ts` owns the actual
  download), `importSave` (decodes through the P3.0 validator, always imports as `kind: 'manual'`,
  and — critically — mints a fresh id when the decoded save's original id was the reserved
  `'autosave'` slot, so re-importing an exported autosave can never collide with and silently
  overwrite the live rolling autosave; refuses to overwrite any other existing id without
  `opts.confirmOverwrite`, returning a typed `conflict` result instead).
- `src/stores/ui.ts` — `saveManagementPanelOpen` + `toggleSaveManagementPanel`/
  `closeSaveManagementPanel`, mirroring the existing `byElectionsPanelOpen` pattern; always reset
  on `hydrateFromSaveState` (never persisted, like the other transient panel flags).
- `src/components/SaveStatusIndicator.vue` (new) — compact `aria-live="polite"` HUD text driven by
  `useSaveStore()`; renders "Saving…"/"Saved"/"Save failed" (or nothing while merely `'pending'`),
  never implying success before the repository resolves. Mounted in `src/components/GameClock.vue`
  next to a new "Saves" toggle button that opens `SaveManagementPanel` through the same
  `ui.openMenu()`/`game.pauseClock()` pause-gate pattern the by-elections panel uses.
- `src/components/ConfirmDialog.vue` (new) — generic accessible confirm modal
  (`role="alertdialog"`, `aria-modal="true"`), focuses its confirm button on mount, Escape cancels.
- `src/composables/useSaveManagement.ts` (new) — wraps `useSaveStore()` for the panel: a
  `manualSaves` computed (filtered to `kind === 'manual'`, sorted newest-first), and
  `createSave`/`overwriteSave`/`renameSave`/`deleteSave`/`exportSave` (Blob + anchor download,
  revokes the object URL after triggering it)/`importSaveFile` (reads a `File` to text, then calls
  `save.importSave`).
- `src/components/SaveManagementPanel.vue` (new) — lists manual slots (label, summary, updated
  date) with overwrite/rename/export/delete actions, a labelled "new save" input, and a file-input
  driven import flow; delete and import-conflict-overwrite both go through `ConfirmDialog`.
  Toggled from `GameClock.vue`, mounted in `src/screens/GameScreen.vue`.
- `src/App.vue` — calls `useSaveStore().startAutosave()` once, for the app's lifetime.
- Covered by 8 new tests in `src/save/autosave.spec.ts` plus a ~16-test block in
  `src/stores/save.spec.ts` (one autosave per coalesced trigger burst; triggers on a resolved feed
  action and a resolved contest action; no write during hydration; `startAutosave` idempotency;
  `saveNow` flushing the debounce; a failed write surfacing as a recoverable error without losing
  the prior autosave; manual-slot create/overwrite/rename/delete; overwrite refusing to target the
  autosave slot; export/import round trip; duplicate-import conflict then confirmed overwrite;
  importing an exported autosave landing as a manual slot under a fresh id; malformed-JSON import
  rejection). All 135 project tests and `npm run build` pass; manually verified via `npm run dev`
  (Playwright smoke pass) — day tick debounces into a "Saved" status, the Saves panel creates/
  deletes a manual slot, and the delete confirmation dialog focuses its confirm button.
- **Acceptance:** after a day tick, a lever action, and a contest action, the live game's
  `writeSave('autosave')` (exercised via the scheduler in `save.spec.ts`) captures all three changes
  in one record — restoring it (P3.0's `loadSave`) reproduces the same playable state. Manual saves
  can be created, named, overwritten, renamed, deleted, and exported/imported without ever
  corrupting the rolling autosave (including the previously-broken edge case of re-importing an
  exported autosave). A failed write leaves the prior autosave and the live game intact and is
  surfaced as a recoverable status, never thrown.

## P3.2 — Main menu, load/new-game flow, and safe game lifecycle ✅

- `src/stores/ui.ts` — extended as the single source of truth for screen/modal state.
  `Screen` grew to `'title' | 'newGame' | 'loadGame' | 'loading' | 'restoring' | 'game' | 'result'`
  (initial screen is now `'title'`, replacing the old `'start'`). New state: `pendingRestoreId`
  (the save id `RestoreScreen` should load, set by `goToRestoring(id)`), `gameMenuOpen`, and
  `confirmModal: { request: ConfirmModalRequest; resolve } | null` — a single awaitable confirm-
  modal slot rather than a collection of component-local booleans. `requestConfirm(request)` returns
  a `Promise<boolean>` and stashes its `resolve` in store state; `resolveConfirm(confirmed)` resolves
  it and clears the slot. `hydrateFromSaveState` always resets `gameMenuOpen` and `confirmModal` to
  their defaults alongside the other transient flags it already cleared — a restore can never land
  on an open menu or a stuck confirm prompt.
- `src/stores/save.ts` — added `startNewGame(partyId)`, the one orchestration entry point for
  starting a brand-new campaign: calls `game.startGame(partyId)` then writes the first autosave
  before the caller's first playable frame. Confirming an overwrite of an active campaign's single
  rolling autosave slot is the caller's job (`ui.requestConfirm`); this action assumes that already
  happened.
- `src/screens/TitleScreen.vue` (new) — the main menu. Shows "Continue" only when an autosave exists
  for the live scenario (party/date metadata shown), plus "New game" and "Load game"; a disabled
  Settings placeholder; footer shows `Save format v{{ CURRENT_SAVE_FORMAT_VERSION }}`.
- `src/screens/NewGameScreen.vue` (new, replaces the deleted `StartScreen.vue`) — the timeline/party
  picker, now behind "← Back" to the title screen. Starting a campaign while one is already active
  (`game.selectedPartyId !== null`) goes through `ui.requestConfirm` first (cancelling leaves the
  picker untouched); confirmed, it calls `save.startNewGame` then `ui.goToLoading()`.
  `PartyCard.vue`'s header comment updated to match the rename.
- `src/screens/LoadGameScreen.vue` (new) — lists saves for the live scenario (newest first), each
  with a "Load" button (`ui.goToRestoring(id)`); deliberately excludes rename/delete/export, which
  stay exclusive to `SaveManagementPanel.vue`.
- `src/screens/RestoreScreen.vue` (new) — on mount, loads `ui.pendingRestoreId` via `save.loadSave`.
  Success shows "Campaign restored." behind an explicit "Continue" button (`ui.goToGame()` — never
  an automatic/timed transition, since a restored clock must always come back paused); failure shows
  `save.lastError?.message` with a "Back to load list" button.
- `src/components/GameMenuPanel.vue` (new) — the in-game menu opened from `GameClock.vue`'s "Menu"
  button (renamed from "Saves", now driving `ui.gameMenuOpen` through the existing
  `ui.openMenu()`/`game.pauseClock()` pause-gate pattern). Resume closes the menu and resumes the
  clock; "Manage saves" hands the pause-gate claim to `SaveManagementPanel` without touching the
  shared `openMenus` counter; "Return to main menu" confirms, then flushes a save (`save.saveNow()`)
  and goes to the title screen without ever clearing the live `game` store; "Restart campaign"
  confirms, then calls `save.startNewGame(game.selectedPartyId)` and goes to the loading screen
  (reusing the current party rather than re-presenting the picker). Mounted in `GameScreen.vue`.
- `src/App.vue` — rewritten as a thin screen router keyed off `ui.screen` (`title`/`newGame`/
  `loadGame`/`loading`/`restoring`/`game`/`result`), and mounts one global `ConfirmDialog` driven by
  `ui.confirmModal`/`ui.resolveConfirm`. Still calls `useSaveStore().startAutosave()` once.
- `src/screens/ResultScreen.vue` — "Play again" became "Main menu": flushes a save
  (`save.saveNow()`) then `ui.goToTitle()`, instead of silently discarding the just-finished
  campaign's final state.
- Covered by 7 new tests in `src/stores/ui.spec.ts` (initial screen; the full legal transition walk
  through every `goTo*` action including `pendingRestoreId`; `requestConfirm`/`resolveConfirm(true
  /false)`; `resolveConfirm` as a no-op with nothing pending; `toggleGameMenu`/`closeGameMenu`;
  `hydrateFromSaveState` resetting every transient UI flag regardless of prior state) and 2 new
  tests in `src/stores/save.spec.ts` (`startNewGame` resets the game store and writes the first
  autosave before returning; a second `startNewGame` replaces the previous campaign's rolling
  autosave rather than merging with it). All 144 project tests, `npm run build`, and
  `npm run validate:data` pass. Manually verified with three Playwright smoke runs against
  `npm run dev`: title → new game → game → menu → return to main menu → continue → restore; the
  load-game screen listing an autosave entry plus the restart-campaign confirm flow; and the
  new-game-over-an-active-campaign confirm/cancel/confirm flow — no console or page errors in any
  run.
- **Acceptance:** the title screen offers Continue (when an autosave exists for the live scenario),
  New game, and Load game. Starting a new campaign over an active one, returning to the main menu,
  and restarting a campaign all require an explicit confirm step backed by a single store-owned
  `confirmModal` slot rather than scattered component booleans. Returning to the main menu and
  finishing a campaign (`ResultScreen`) both flush a save before navigating away, so no progress is
  silently lost. A restored campaign's clock always starts paused, and the player must explicitly
  press Continue to enter play.

## P3.3 — Campaign action economy ✅

- `src/types/action.ts` (new) — the shared contract: `ActionId`/`ActionCost` (`money`/`staff`/
  `leadership`, each optional), `ActionForecast`, `ActionDefinition` (`cooldownDays`/`durationDays`/
  `cost`/`recurringCost?`/`forecast`), `ActionDenialReason` and `ActionAvailability`, the per-call
  `ActionResourceState` snapshot the store assembles, `ActiveCommitment` (a running multi-day
  action — `staffHeld`/`leadershipHeld`/`pollingImpacts`/`financeDelta`/`membershipDelta`/
  `staffCapacityBonus?`/`resultLabel`, keyed `${actionId}:${partyId}:${startedDate}`), and
  `ActionOutcome` (what resolution hands back, applied immediately for an instant action or copied
  onto the commitment for a multi-day one). `LeverId` moved here from `stores/game.ts` (re-exported
  from there for existing consumers).
- `src/sim/actions.ts` (new, pure, store-free) — the one engine both P2.9 levers and P2.8 contest
  actions share: validate → pay → apply → record. `LEVER_ACTIONS` is the audited six-lever set:
  `fundraising`/`socialMedia`/`policy` stay instant (`durationDays: 0`); `staffing`/`campaigning`/
  `leadership` are the three multi-day commitments (5/7/5 days), `campaigning` carrying a
  `recurringCost` (£3,000/day). `canTakeAction(def, resources)` checks cooldown → already-committed
  → commitment-capacity (multi-day only) → money → staff → leadership, in that order, and is the
  *only* place an action can be denied. `resolveLeverAction(leverId, partyId, date)` is deterministic
  per `(leverId, partyId, date)` via `seededUniform` — same inputs always produce the same
  `ActionOutcome`, regardless of when a commitment's result is actually applied. `buildCommitment`
  turns a resolved multi-day action into an `ActiveCommitment`; `advanceCommitmentsForDay` is the
  pure daily-tick step — sorts by commitment id (not insertion order) before splitting into
  `stillActive`/`expired` and summing each party's recurring money cost for the day, so two
  commitments started the same day in different in-memory orders still resolve identically.
  Resource constants: `STAFF_CAPACITY_BASE` (40) + per-party bonus, capped `STAFF_CAPACITY_MAX`
  (100); `LEADERSHIP_ATTENTION_MAX` (100, a fixed pool with no passive regen — only held/released by
  commitments); `MAX_CONCURRENT_COMMITMENTS` (3, the blunt "time/turn capacity" cap).
- `src/sim/byElections.ts` — every `CONTEST_ACTIONS_BY_TIER` entry gained a `cost: ActionCost`
  (`ignore` actions stay free; `local_push`/`nationalise`/`token_effort` cost money and/or staff/
  leadership). `resolveContestAction` is unchanged — contest outcomes still depend on contest-
  specific data, so it wasn't merged into `resolveLeverAction`.
- `src/stores/game.ts` — new state: `staffCapacityBonus: Record<PartyId, number>` and
  `activeCommitments: ActiveCommitment[]`. New getters: `staffCapacity(partyId)`,
  `staffHeld(partyId)`/`leadershipHeld(partyId)` (summed across that party's active commitments),
  `activeCommitmentCount(partyId)`, `actionResourceState(partyId, actionId, cooldownDays)` (the
  snapshot `canTakeAction` validates against), `leverAvailability(leverId)` and
  `contestActionAvailability(actionDef)` (the two `ActionAvailability` lookups components consume —
  the latter short-circuits to `{ allowed: true }` for a zero-cost action like `ignore` even with no
  party selected, matching `actionContest`'s existing leniency). New actions: `payActionCost`,
  `applyInstantOutcome`, `runLeverAction(leverId)` (replaces the deleted `runFundraisingAppeal`/
  `runSocialMediaCampaign` — validates via `leverAvailability`, pays, then either applies the
  outcome instantly or pushes an `ActiveCommitment`; silently a no-op if denied, so a component can
  never bypass validation by calling it directly), `cancelCommitment(id)` (forfeits the upfront cost
  and any of its outcome, simply removing it), and `advanceCommitments()` (wraps the pure
  `advanceCommitmentsForDay`, applies each expired commitment's outcome and every active
  commitment's recurring money cost, called from `tickDay`). `actionContest` now validates via
  `contestActionAvailability` and pays via `payActionCost` before calling the unchanged
  `resolveContestAction`.
- `src/types/save.ts` / `src/save/codec.ts` — `GameSaveStateV1` gained `staffCapacityBonus` and
  `activeCommitments` as required fields (kept at format version 1 — no shipped saves with the old
  shape exist yet, so a full v1→v2 migration would be disproportionate); `codec.ts` gained a runtime
  `isActiveCommitmentArray` guard alongside the existing hand-rolled type guards.
- `src/composables/useActionAvailability.ts` (new) — `describeDenial(reason)` maps each
  `ActionDenialReason` to the player-facing text shown as a disabled button's title/label.
- `src/composables/usePartyLevers.ts` — rewritten to map generically over `LEVER_ACTIONS` instead of
  two hand-written entries, returning `{ id, label, description, forecastSummary, cooldownDays,
  allowed, disabledReason, requiresConfirmation, run }` per lever.
- `src/components/LeverCard.vue` — gained `allowed`/`disabledReason?`/`forecastSummary?`/
  `requiresConfirmation?` props; disables its button with the denial reason as the title, and gives
  high-cost/irreversible levers (the three multi-day commitments) a second confirming click before
  firing.
- `src/components/PartyPanel.vue` — its two hardcoded `<LeverCard>` usages became one
  `v-for="lever in levers"` over `usePartyLevers()`'s generic list.
- `src/composables/useByElections.ts` — `actionsFor(contest)` now maps each contest action through
  `game.contestActionAvailability` to attach `allowed`/`disabledReason`.
- `src/components/ContestCard.vue` — renders each action's disabled state/reason, and gives
  `nationalise` (the one high-cost, high-risk contest response) the same two-click confirm pattern
  as a multi-day lever commitment.
- Covered by a new `src/sim/actions.spec.ts` (pure-engine unit tests: every `canTakeAction` denial
  reason plus the allowed case; `resolveLeverAction` determinism across all six levers and variance
  across date/party; `buildCommitment`'s shape; `advanceCommitmentsForDay`'s active/expired
  boundary, id-ordering independent of input order, and per-party recurring-cost summation) and a
  new "UI cannot bypass validation" block in `src/stores/game.spec.ts` (an unaffordable
  `runLeverAction` and an unaffordable `actionContest` are both no-ops against the store's own
  `toSaveState()` snapshot; a multi-day commitment holds its staff for the duration and rejects a
  repeat attempt while running; a party already at the concurrent-commitment cap is denied a new
  multi-day commitment even with resources to spare, while instant actions stay ungated; a
  commitment's outcome is only applied at expiry on the daily tick, never the instant it starts).
  The existing P2.9 lever tests and P3.0/P3.1 save round-trip tests were updated to call the new
  generic `runLeverAction('fundraising' | 'socialMedia')` instead of the two deleted hand-rolled
  actions. All 167 project tests, `npm run build`, and `npm run validate:data` pass.
- **Acceptance:** every lever and contest response is a typed `ActionDefinition`/`ContestActionDef`
  with a real cost, cooldown, and (where relevant) multi-day duration with a recurring cost — no
  lever is a free, infinitely repeatable polling button. Money, staff capacity, leadership
  attention, and concurrent-commitment slots are meaningful, distinct resources; membership is never
  used as a generic currency. `canTakeAction`/`resolveLeverAction`/`advanceCommitmentsForDay` are
  pure and store-free; every store action that spends a cost or applies an outcome routes through
  them, so a component can only ever request an action by id. Multi-day commitments resolve their
  outcome once, deterministically, at the moment they start, and only apply it at expiry — replaying
  the same seed produces the same result regardless of save/load timing. P2.8's `ContestCard` and
  P2.9's `LeverCard`/`PartyPanel` both surface disabled reasons and a confirm step for high-cost/
  irreversible actions.

## P3.4 — Targeted campaigning and opponent strategy ✅

- `src/types/action.ts` — `TargetScope` (`kind: 'national' | 'tier' | 'seat' | 'contest'` plus
  whichever id field matches, and a UI-resolved `label`). `ActiveCommitment`/`ActionOutcome` both
  gained optional `targetScope?`/`localInfluenceMagnitude?` so a targeting commitment carries where
  it was aimed and how much bounded local influence it contributes, without a parallel commitment
  type. `src/types/save.ts`/`src/save/codec.ts` gained an optional `localInfluence?` save field
  (additive, no version bump — an old save just decodes with `{}`).
- `src/sim/targeting.ts` (new, pure, store-free) — one `TARGETED_CAMPAIGN` action template
  (£25k + 12 staff upfront, £2k/day recurring, 14-day duration/cooldown) shared by every scope.
  `targetActionId(scope)` namespaces a scope into the shared `ActionId` space (`targeting:seat:
  E14000530`, etc.) so cooldown/`alreadyCommitted` checks are per-target, not per-action-type, and
  a party can run concurrent campaigns in different places. `isRegionTargetable` restricts 'seat'
  targeting to commons regions (the only tier with the majority/electorate stats to show
  competitiveness honestly). `regionIdsForScope` resolves any scope (national/tier/seat/contest) to
  the concrete region ids it applies to. `resolveTargetingAction(scope, partyId, date)` is
  deterministic via `seededUniform`: a local scope's real effect is a bounded
  `localInfluenceMagnitude` (0.4-0.6), with only a small, transparent fraction (15%) spilling into
  national polling; a national scope skips local influence entirely and resolves as a slightly
  larger flat polling impact. `clampLocalInfluence`/`NET_LOCAL_INFLUENCE_CAP` bound stacking in
  either direction; `leadingPartyNetInfluence` resolves competing parties' campaigns in the same
  region via a net-lead-over-runner-up comparison against `LOCAL_INFLUENCE_FLIP_THRESHOLD`, so two
  rival campaigns in the same seat cancel out rather than both "winning".
- `src/sim/opponents.ts` (new, pure, store-free, zero randomness) — deterministic opponent
  strategy. `isOpponentCadenceDay` gates re-evaluation to once every `OPPONENT_CADENCE_DAYS` (7)
  days. `marginalityScore(seat)` is `majority / electorate` (capped at 1, null if either stat is
  missing). `rankTargetingMoves(partyId, commonsRegions, playerTargetedRegionIds)` ranks every
  commons seat as a defend (held by `partyId`), pursue (held by anyone else), or respond (the
  player already has an active commitment there) move, scored by how marginal it is and boosted
  1.5x for a respond move, ties broken on region id for a stable order — a plain sort, never an
  LLM or hidden roll (spec guardrail). `selectOpponentMove` walks the ranked list and returns the
  first move the party can actually afford right now, or `null` if nothing is — "preserve scarce
  resources" falls out of the affordability check rather than a separate budget rule.
- `src/sim/actions.ts` — `buildCommitment`'s `actionId` param widened from `LeverId` to the full
  `ActionId` space so targeting commitments share the exact same builder levers use.
- `src/sim/projection.ts` — `projectSeatsByParty` gained an optional 4th `localInfluenceByRegion`
  param; for each seat it overrides the uniform-swing winner with `leadingPartyNetInfluence`'s
  result whenever a region has a decisive local lead, so a scheduled election (and the live seat
  projection shown throughout play) "consumes" accumulated local influence with no extra plumbing.
- `src/stores/scenario.ts` — `REGIONAL_TIER_IDS` exported for reuse; new `tierLabel(tierId)`
  (human-readable label per known tier, falling back to the raw slug) and `regionById` getter (a
  generic id -> Region lookup spanning every tier including council wards, for resolving any
  `TargetScope.regionId` without knowing which tier it came from).
- `src/stores/game.ts` — new `localInfluence: Record<regionId, Record<PartyId, number>>` state.
  New getters: `targetingAvailability(partyId, scope)` (the same `canTakeAction` gate levers use,
  shared by the player's panel and the opponent AI), `targetingCooldownRemaining(scope)`,
  `playerTargetedRegionIds` (every commons region the selected player has an active targeting
  commitment covering — the opponent AI's "respond to player focus" input),
  `localInfluenceAt(regionId)`, and `activeTargetingCommitments` (every in-flight commitment with a
  `targetScope` — the map overlay's and panel's "who's campaigning where" source). New actions:
  `applyLocalInfluence(scope, partyId, magnitude)` (adds/reverses a commitment's local-influence
  contribution across its scope's regions, clamped), `runTargetingAction(partyId, scope,
  rationale?)` (the one entry point every targeted campaign — player or opponent — goes through:
  validate via `targetingAvailability`, pay, resolve, push the commitment, apply local influence,
  record a feed entry — an AI move's `rationale` is recorded verbatim as the feed headline, "record
  public-facing summaries" per spec step 4), and `runOpponentCadence()` (on each cadence day, every
  eligible non-player party — excluding `scope: 'local'` parties and the player's own — gets at most
  one move via `rankTargetingMoves`/`selectOpponentMove`, called from `tickDay`). A by-election
  contest action now adds a bounded polling bonus (50% of accumulated local influence) when the
  selected party already has a targeting commitment running in that contest's region — "translate
  it into contest probability" (spec step 3) layered on top of `resolveContestAction`'s own odds,
  not changing them. `cancelCommitment`/`advanceCommitments` both reverse a targeting commitment's
  local influence on the way out, same as they already reversed staff/leadership. Save round-trip
  (`toSaveState`/`hydrateFromSaveState`) and the existing party/lever-cooldown/commitment hydration
  guards (`pickKnownLeverCooldowns`, `pickKnownCommitments`) were extended to recognise targeting
  action ids (`targeting:` prefix) alongside `LeverId`.
- `src/map/MapRenderer.ts`/`SvgMapRenderer.ts`/`HexMapRenderer.ts` — `RegionDisplayState` gained an
  optional `strokeColor?`, consumed by both renderers' style/overlay paths (falling back to the
  existing default border colour), so a region can be tinted to show targeting/contest/opponent
  activity without touching `fill` (which still encodes seat-holder colour).
- `src/components/MapView.vue` — a new overlay-tinting pass applied to the built `RegionState`
  just before render: pending contests tinted purple, active targeting commitments tinted cyan
  (player) or orange (opponent), each gated by a `ui.mapOverlays` toggle. A new bottom-left
  legend/toggle panel lets the player switch each overlay on/off; new watchers re-draw on
  `ui.mapOverlays`, `game.activeTargetingCommitments`, or `game.contests` changes.
- `src/stores/ui.ts` — `targetingPanelOpen` + `mapOverlays: Record<'commitments' | 'contests' |
  'opponentActivity', boolean>` (transient, never persisted — `hydrateFromSaveState` always resets
  both to defaults), with `toggleTargetingPanel`/`closeTargetingPanel`/`toggleMapOverlay` actions.
- `src/composables/useTargeting.ts` (new) — builds the flat, rankable option list the panel shows:
  national, one per regional/devolved tier, and the top 30 most marginal commons seats (by the same
  `marginalityScore` the opponent AI ranks by) — deliberately not map-click-driven, per the spec
  guardrail that targeting "must work without precision pointer gestures". Each option carries its
  `allowed`/`disabledReason`/cooldown and a `run` callback wired to `runTargetingAction`.
- `src/components/TargetOptionRow.vue`/`TargetingPanel.vue` (new) — the panel UI, modeled on
  `LeverCard.vue`/`ByElectionsPanel.vue`: a two-click confirm per option, an optional "View on map"
  button wired through `ui.requestMapFocus` (never touching the map directly), gated open by
  `ui.targetingPanelOpen`.
- `src/components/GameClock.vue`/`src/screens/GameScreen.vue` — a new "Target" button beside the
  existing "Menu" button, sharing the same `ui.openMenu()`/`game.pauseClock()` pause-gate pattern;
  `TargetingPanel` mounted in `GameScreen.vue`.
- Covered by new `src/sim/targeting.spec.ts` (`targetActionId` namespacing/uniqueness,
  `isTargetingActionId`, `isRegionTargetable`, `regionIdsForScope` for all four scope kinds,
  `resolveTargetingAction` determinism and its local-vs-national shape, `clampLocalInfluence`, and
  `leadingPartyNetInfluence`'s no-campaign/under-threshold/over-threshold/lone-party cases) and new
  `src/sim/opponents.spec.ts` (`marginalityScore`'s null/bounded cases, `isOpponentCadenceDay`'s
  cadence boundary, `rankTargetingMoves`'s defend/pursue/respond assignment and score ordering with
  region-id tie-break, and `selectOpponentMove`'s affordable-skip/none-affordable/empty-list cases).
  All 201 project tests (bar two long-running, pre-existing P2.8 tests that only time out under
  full-suite CPU contention and pass in isolation — unrelated to this task), `npm run build`, and
  `npm run validate:data` pass.
- **Acceptance:** a player can aim a campaign at a real place — a seat, a tier, a contest, or the
  whole country — using only real region/tier/contest identifiers, never an invented one. The
  effect is bounded and transparent: a fixed local-influence range per campaign, a small defined
  national spillover, and an explicit cancellation rule when rival campaigns target the same place.
  Every opposing party's targeting choice is a plain, inspectable ranking over real marginality
  data — never an LLM call or a hidden dice roll — and is bounded by the same cost/cooldown/capacity
  gate the player is held to, so an under-resourced party simply sits a cadence tick out. The map
  shows targeting/contest/opponent activity through toggleable overlays without the per-tier
  `regionState/` builders ever knowing P3.4 exists.

## P3.5 - Election resolution and changing political world state DONE

- `src/types/election.ts` — added the P3.5 Commons election contracts:
  `ElectionInstance`, `ElectionOutcome`, and `ElectionSeatWinner`. Outcomes identify tier/date,
  status, model/provenance, eligible seats, per-seat winners, party totals, changes from the
  starting Parliament, decisive seats, and the selected party's objective result. P2.8 `Contest`
  remains the runtime vacancy type; the new outcome ledger is the mutable representation overlay.
- `src/sim/elections/commons.ts` (new) — pure Commons resolver. It combines the existing P2.0
  uniform-national-swing baseline with P3.4 local commitments (`leadingPartyNetInfluence`) and
  emits a deterministic, inspectable `ElectionOutcome` rather than only a count map. Every eligible
  seat gets exactly one winner, counts reconcile to the seat total, seats without result breakdowns
  fall back to their incumbent, and local commitments are recorded as their own winner source.
- `src/stores/game.ts` — added `electionOutcomes` as the applied outcome ledger, reset on new
  campaigns and persisted through `toSaveState()`/`hydrateFromSaveState()`. `checkElectionResult()`
  now resolves the Commons election once, applies it atomically, records a feed entry, pauses the
  clock, and sets the existing win/loss flag from the applied outcome. Re-running the check cannot
  double-apply the same election. `commonsSeatsByParty`, `playerSeatCount`, and
  `currentCommonsSeatHolder(regionId, seatIndex)` now read from the latest applied Commons outcome
  before falling back to immutable scenario composition.
- `src/types/save.ts` / `src/save/codec.ts` — added optional `electionOutcomes` to the v1 game save
  state (additive, no version bump) and runtime validation for outcomes/winner rows. Hydration
  validates outcome seat ids against the current Commons regions and accepts representation party
  ids found in Commons seat/result data, not just playable party ids, so real local/independent
  constituency parties survive a save round trip.
- `src/map/regionState/buildSeatRegionState.ts`, `src/components/MapView.vue`, and
  `src/components/HemicycleView.vue` — Westminster map fill/tooltips and the party makeup
  hemicycle now use `game.currentCommonsSeatHolder()` after an election. Regional, council, and
  Lords views deliberately continue to use static scenario composition until their electoral
  systems are modelled.
- `src/screens/ResultScreen.vue` — expanded from a simple win/loss screen into an election result
  moment: player seats, change from the starting Parliament, majority threshold, model/provenance,
  reconciliation count, and the first decisive seat changes. Existing Continue and Main menu flows
  remain, with Main menu still flushing a save first.
- Covered by `src/sim/elections/commons.spec.ts` (winner/count reconciliation, local-commitment
  override, same-input determinism) and new P3.5 blocks in `src/stores/game.spec.ts` (applied
  outcome becomes current Commons composition, no double application, and save/hydrate preserves
  outcomes/current holders). Full suite: 207 tests pass with a 20s Vitest timeout for the existing
  long-run by-election tests; `npm run build` and `npm run validate:data` pass.
- **Acceptance:** resolving the eligible Commons election produces one deterministic, inspectable
  applied outcome. The map, hemicycle, party statistics, feed, save game, and objective result all
  reflect the applied outcome after refresh. The same election cannot be applied twice, and seat
  totals reconcile to the Commons total.

## P3.6 - Campaign objectives, scenario arcs, and replayable content DONE

- `src/types/scenario.ts`, `src/types/objective.ts`, and `src/types/campaignArc.ts` — added the
  versioned `campaign` scenario section: briefing/provenance notes, electoral horizon, primary and
  optional objectives, feature flags, expected tiers, tuning values, and authored arc/stage/branch
  records with named consequences.
- `src/data/scenarios/uk-2025-01-01/scenario.json` — authored the vertical slice: opening briefing,
  the Commons-majority primary objective, two visible optional objectives, one hidden objective,
  and two branching arcs tied to existing scripted event choices (`winter-storm-disruption-2025`
  and `trump-declares-war-on-iran`).
- `src/sim/objectives.ts` and `src/sim/arcs.ts` — pure evaluators for objective lifecycle records
  and campaign arc branching. They observe polling, finance, membership, action/feed history,
  election outcomes, projected/current seats, dates, and arc consequences without mutating store
  state directly.
- `src/stores/game.ts` and `src/types/save.ts` — campaign objective and arc records are now mutable
  playthrough state, initialised on new game, updated after relevant player choices/actions and
  election outcomes, projected into saves, and restored through the existing hydration seam.
- `src/components/CampaignJournal.vue`, `src/screens/GameScreen.vue`, and
  `src/screens/NewGameScreen.vue` — added the scenario briefing to new-game setup and an in-game
  campaign journal showing visible objectives, active arcs, and completed consequences without
  revealing hidden branches early.
- `scripts/data/validate-scenario.mjs` — validates campaign schema version, objective party/date
  conditions, duplicate ids, arc stage references, event/action branch references, and consequence
  references before content reaches the app.
- Covered by new `src/sim/objectives.spec.ts` and `src/sim/arcs.spec.ts`, plus save restoration
  coverage in `src/stores/save.spec.ts`. The two existing long-run by-election tests now carry an
  explicit 15s timeout because they simulate a full year over the full scenario dataset. Full
  verification: 212 tests pass; `npm run build` and `npm run validate:data` pass.
- **Acceptance:** a new campaign starts with a readable briefing and active objective records;
  authored event choices record arc consequences into the feed and journal; objective/arc state
  persists through save/load; hidden objective content stays hidden until its consequence exists;
  invalid campaign relationships fail data validation.

## P3.7 - Onboarding and simulation explainability DONE

- `src/types/tutorial.ts` (new) - added tutorial milestone and explanation-record contracts.
  Milestones cover campaign start, first lever, first paused event, first contest, first targeted
  commitment, first poll, and first election result. Explanation records group contributors into
  player-meaningful causes: events/actions, policy alignment, local commitments, bounded variance,
  and election model output.
- `src/sim/explanations.ts` (new) - pure builders for poll, contest, and election explanations.
  They use recorded polling impacts, contest results, election winners, provenance, and decisive
  seats without inventing false precision.
- `src/stores/game.ts` and `src/types/save.ts` - tutorial completion/dismissal state and explanation
  records are mutable campaign state, reset on new campaign, persisted through saves, restored with
  safe defaults for old saves, and linked from feed entries, contests, and election outcomes.
- `src/components/GoalStatusStrip.vue`, `TutorialOverlay.vue`, `HelpPanel.vue`, and
  `ExplanationDetails.vue` (new) - added a compact HUD strip for objective/election/decision/pause
  status, a dismissible non-blocking guide overlay with Escape support, a small glossary, and a
  reusable explanation modal. `GameScreen.vue`, `EventFeed.vue`, `ContestCard.vue`,
  `ByElectionsPanel.vue`, and `ResultScreen.vue` mount the surfaces and expose "Why?" drill-downs.
- `src/stores/ui.ts` - added transient help-panel and active-explanation UI state, cleared on save
  hydration like other open-panel state.
- Covered by new store tests in `src/stores/game.spec.ts`: poll releases attach explanation records,
  tutorial dismissal survives save/restore without duplicate guidance, contest explanations are
  linked from resolved contests, and election explanations are linked from applied outcomes. Full
  verification: 213 tests pass; `npm run build` passes.
- **Acceptance:** a first-time player sees the current objective, next GE countdown, highest-priority
  decision, and pause reason without reading external docs; guidance can be skipped and stays
  dismissed after save/load; poll, contest, and election outcomes expose concise recorded
  explanations of the factors the simulation actually used.
