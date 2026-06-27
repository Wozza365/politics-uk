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
