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
