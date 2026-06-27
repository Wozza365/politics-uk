import type { ActiveCommitment } from './action'
import type { Contest } from './election'
import type { FeedEntry } from './event'
import type { ISODate, PartyFinance, PartyId } from './party'
import type { PollingSnapshot } from './scenario'
import type { PollingImpact } from '@/sim/poll'

// P3.0 versioned save-game contract (spec — autosave/load UI groundwork). A `SaveGameV1` is the
// one trustworthy representation of a live campaign; `src/save/codec.ts` is the only place that
// turns untrusted storage bytes into one of these, and `src/stores/game.ts`/`src/stores/ui.ts`'s
// `toSaveState()`/`hydrateFromSaveState()` are the only seam between this payload and live store
// state — never let a repository or component reach into store internals directly.

export type SaveKind = 'autosave' | 'manual'

/** Bump this — and add a migration in `src/save/codec.ts` — whenever `GameSaveStateV1`/
 * `UiSaveStateV1` changes shape. Old saves are migrated forward; saves from a *future* version of
 * the app (higher than this) are rejected rather than guessed at. */
export const CURRENT_SAVE_FORMAT_VERSION = 1 as const
export type SaveFormatVersion = typeof CURRENT_SAVE_FORMAT_VERSION

export interface SaveMetadata {
  id: string
  formatVersion: SaveFormatVersion
  scenarioId: string
  kind: SaveKind
  createdAt: string // ISO 8601 datetime (not `ISODate` — this is a wall-clock save timestamp, not an in-game date)
  updatedAt: string
  label?: string
  /** Drawn once per playthrough (`startGame`), not derived from anything deterministic — reserved
   * for future sequential-randomness systems, which must store their own cursor/state alongside
   * it rather than relying on ambient `Math.random()` (the current sim keys everything off
   * `date`/id strings instead, so nothing needs this yet). */
  playthroughSeed: number
  /** Thumbnail-free one-line summary (e.g. party/polling/cash) computed once at write time (P3.1
   * save policy: manual-slot metadata is immutable) — never recomputed from live state on read. */
  summary?: string
}

/** Mutable `game` store state worth persisting — static scenario data, derived getters, and
 * component/UI-only state are rebuilt on load, never stored here. */
export interface GameSaveStateV1 {
  selectedPartyId: PartyId | null
  date: ISODate
  clockMsPerDay: number
  polling: Record<PartyId, number>
  pollingHistory: PollingSnapshot[]
  pendingPollImpacts: PollingImpact[]
  finance: Record<PartyId, PartyFinance>
  membership: Record<PartyId, number>
  leverCooldowns: Record<string, ISODate>
  /** Permanent staff-capacity growth from completed "staffing" drives (P3.3) — see
   * `sim/actions.ts`'s `STAFF_CAPACITY_BASE`/`STAFF_CAPACITY_MAX`. */
  staffCapacityBonus: Record<PartyId, number>
  /** Multi-day lever commitments in flight at save time (P3.3) — each carries its own
   * already-resolved outcome, so resuming a save mid-commitment still applies exactly once, on
   * the same in-game day, as an uninterrupted playthrough would. */
  activeCommitments: ActiveCommitment[]
  /** P3.4 bounded local-influence map, keyed by region id then party id — optional so a save
   * written before this field existed still decodes (`decodeSaveEnvelope` treats it as additive,
   * no version bump needed; `hydrateFromSaveState` falls back to `{}`). */
  localInfluence?: Record<string, Record<PartyId, number>>
  feed: FeedEntry[]
  contests: Contest[]
  /** `pendingEvents` are entries straight out of the authored event pool (`sim/events.ts`), so
   * only their ids are saved; hydration looks them back up rather than duplicating authored
   * content into every save. */
  pendingEventIds: string[]
  firedEventIds: string[]
  salience: Record<string, number>
  result: 'won' | 'lost' | null
}

/** Mutable `ui` store state worth restoring — deliberately just display preferences, never an
 * open modal/panel or a running timer (those reset on load regardless of what's saved). Typed
 * loosely (`string`) at the contract boundary since the allowed value sets live in `stores/ui.ts`
 * and `stores/scenario.ts`; `hydrateFromSaveState` validates/narrows with a safe fallback. */
export interface UiSaveStateV1 {
  activeView: string
  activeCouncilLevel: string
  westminsterRenderer: string
}

export interface SaveStateV1 {
  game: GameSaveStateV1
  ui: UiSaveStateV1
}

export interface SaveGameV1 extends SaveMetadata {
  formatVersion: 1
  state: SaveStateV1
}

/** Lightweight projection for the load screen's list — no full `state` payload. */
export interface SaveSummary {
  id: string
  formatVersion: SaveFormatVersion
  scenarioId: string
  kind: SaveKind
  createdAt: string
  updatedAt: string
  label?: string
  summary?: string
  date: ISODate
  selectedPartyId: PartyId | null
}

export type SaveValidationErrorType =
  | 'invalid-json'
  | 'invalid-envelope'
  | 'unknown-scenario'
  | 'unsupported-version'
  | 'corrupt-state'

/** Narrow, recoverable error shape — never a thrown exception — so a corrupt/obsolete record can
 * be reported to the player without crashing the app or touching any other save. */
export interface SaveValidationError {
  type: SaveValidationErrorType
  message: string
}

export type SaveDecodeResult =
  | { ok: true; save: SaveGameV1 }
  | { ok: false; error: SaveValidationError }
