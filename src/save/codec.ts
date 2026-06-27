// Pure parse/validate/migrate functions for the save-game contract (`@/types/save.ts`). Nothing
// here touches a store, IndexedDB, or any other side effect — `stores/save.ts` and
// `save/repository.ts` are the only callers. Untrusted bytes only ever become a trusted
// `SaveGameV1` by passing through `decodeSaveGame`/`decodeSaveEnvelope`.
import type {
  ActiveCommitment,
  Contest,
  ElectionOutcome,
  FeedEntry,
  GameSaveStateV1,
  PollingSnapshot,
  SaveDecodeResult,
  SaveGameV1,
  SaveKind,
  SaveSummary,
  SaveValidationError,
  UiSaveStateV1,
} from '@/types'
import { CURRENT_SAVE_FORMAT_VERSION } from '@/types'
import type { PollingImpact } from '@/sim/poll'

function err(type: SaveValidationError['type'], message: string): { ok: false; error: SaveValidationError } {
  return { ok: false, error: { type, message } }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

/** A record whose values all pass `valueGuard` — used for the various `Record<PartyId, ...>` maps,
 * where we don't know every key (party id) up front but do know the shape every value must have. */
function isRecordOf<T>(value: unknown, valueGuard: (v: unknown) => v is T): value is Record<string, T> {
  return isPlainObject(value) && Object.values(value).every(valueGuard)
}

function isPollingSnapshotArray(value: unknown): value is PollingSnapshot[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => isPlainObject(entry) && isString(entry.date) && isRecordOf(entry.polling, isNumber))
  )
}

function isPollingImpactArray(value: unknown): value is PollingImpact[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => isPlainObject(entry) && isString(entry.partyId) && isNumber(entry.magnitude) && isString(entry.source))
  )
}

function isFeedEntryArray(value: unknown): value is FeedEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isPlainObject(entry) &&
        isString(entry.id) &&
        isString(entry.date) &&
        isString(entry.headline) &&
        (entry.status === 'actioned' || entry.status === 'unactioned'),
    )
  )
}

function isActiveCommitmentArray(value: unknown): value is ActiveCommitment[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isPlainObject(entry) &&
        isString(entry.id) &&
        isString(entry.actionId) &&
        isString(entry.partyId) &&
        isString(entry.startedDate) &&
        isString(entry.endsDate) &&
        isNumber(entry.staffHeld) &&
        isNumber(entry.leadershipHeld) &&
        isPollingImpactArray(entry.pollingImpacts) &&
        isNumber(entry.financeDelta) &&
        isNumber(entry.membershipDelta) &&
        isString(entry.resultLabel),
    )
  )
}

function isContestArray(value: unknown): value is Contest[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isPlainObject(entry) &&
        isString(entry.id) &&
        (entry.contestTier === 'commons' || entry.contestTier === 'council') &&
        isString(entry.regionId) &&
        isString(entry.geometryRef) &&
        isString(entry.seatName) &&
        isString(entry.incumbentParty) &&
        isString(entry.calledDate) &&
        (entry.status === 'pending' || entry.status === 'resolved'),
    )
  )
}

function isElectionOutcomeArray(value: unknown): value is ElectionOutcome[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isPlainObject(entry) &&
        isString(entry.id) &&
        isString(entry.instanceId) &&
        entry.tier === 'commons' &&
        isString(entry.date) &&
        (entry.status === 'pending' || entry.status === 'applied') &&
        (entry.appliedAt === undefined || isString(entry.appliedAt)) &&
        entry.model === 'uniform-national-swing-local-commitments' &&
        isString(entry.provenance) &&
        isNumber(entry.eligibleSeatCount) &&
        isRecordOf(entry.countsByParty, isNumber) &&
        isRecordOf(entry.changesByParty, isNumber) &&
        isString(entry.summary) &&
        (entry.playerObjective === undefined || entry.playerObjective === 'won' || entry.playerObjective === 'lost') &&
        isElectionSeatWinnerArray(entry.winners) &&
        isElectionSeatWinnerArray(entry.decisiveSeats),
    )
  )
}

function isElectionSeatWinnerArray(value: unknown): value is ElectionOutcome['winners'] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isPlainObject(entry) &&
        isString(entry.regionId) &&
        isString(entry.geometryRef) &&
        isNumber(entry.seatIndex) &&
        isString(entry.seatName) &&
        isString(entry.previousParty) &&
        isString(entry.winnerParty) &&
        (entry.source === 'national-swing' || entry.source === 'local-commitment' || entry.source === 'incumbent-fallback') &&
        (entry.projectedShare === undefined || isNumber(entry.projectedShare)) &&
        (entry.runnerUpParty === undefined || isString(entry.runnerUpParty)) &&
        (entry.runnerUpProjectedShare === undefined || isNumber(entry.runnerUpProjectedShare)),
    )
  )
}

function isGameSaveState(value: unknown): value is GameSaveStateV1 {
  if (!isPlainObject(value)) return false
  return (
    (value.selectedPartyId === null || isString(value.selectedPartyId)) &&
    isString(value.date) &&
    isNumber(value.clockMsPerDay) &&
    isRecordOf(value.polling, isNumber) &&
    isPollingSnapshotArray(value.pollingHistory) &&
    isPollingImpactArray(value.pendingPollImpacts) &&
    isRecordOf(value.finance, isPlainObject) &&
    isRecordOf(value.membership, isNumber) &&
    isRecordOf(value.leverCooldowns, isString) &&
    isRecordOf(value.staffCapacityBonus, isNumber) &&
    isActiveCommitmentArray(value.activeCommitments) &&
    (value.localInfluence === undefined || isRecordOf(value.localInfluence, (v): v is Record<string, number> => isRecordOf(v, isNumber))) &&
    isFeedEntryArray(value.feed) &&
    isContestArray(value.contests) &&
    (value.electionOutcomes === undefined || isElectionOutcomeArray(value.electionOutcomes)) &&
    isStringArray(value.pendingEventIds) &&
    isStringArray(value.firedEventIds) &&
    isRecordOf(value.salience, isNumber) &&
    (value.result === null || value.result === 'won' || value.result === 'lost')
  )
}

function isUiSaveState(value: unknown): value is UiSaveStateV1 {
  return (
    isPlainObject(value) &&
    isString(value.activeView) &&
    isString(value.activeCouncilLevel) &&
    isString(value.westminsterRenderer)
  )
}

/** Decodes the outer envelope and migrates it to the current format, but does *not* check the
 * scenario id — used by `list()` (which surfaces saves regardless of which scenario they target)
 * as well as by `decodeSaveGame` (which adds that check on top). */
export function decodeSaveEnvelope(value: unknown): SaveDecodeResult {
  if (!isPlainObject(value)) return err('invalid-envelope', 'Save data is not a recognisable object.')

  const formatVersion = value.formatVersion
  if (!isNumber(formatVersion) || formatVersion < 1) {
    return err('invalid-envelope', 'Save data has no valid format version.')
  }
  if (formatVersion > CURRENT_SAVE_FORMAT_VERSION) {
    return err('unsupported-version', `Save was created by a newer version of the app (format v${formatVersion}).`)
  }

  // No migrations exist yet (only format v1 has ever shipped) — `migrated` is where a v1->v2 etc.
  // step would be applied before falling through to the shape checks below.
  const migrated: Record<string, unknown> = value

  if (
    !isString(migrated.id) ||
    !isString(migrated.scenarioId) ||
    (migrated.kind !== 'autosave' && migrated.kind !== 'manual') ||
    !isString(migrated.createdAt) ||
    !isString(migrated.updatedAt) ||
    !isNumber(migrated.playthroughSeed) ||
    (migrated.label !== undefined && !isString(migrated.label)) ||
    (migrated.summary !== undefined && !isString(migrated.summary))
  ) {
    return err('invalid-envelope', 'Save metadata is missing or malformed.')
  }

  const state = migrated.state
  if (!isPlainObject(state) || !isGameSaveState(state.game) || !isUiSaveState(state.ui)) {
    return err('corrupt-state', 'Save payload is corrupt or missing required fields.')
  }

  return {
    ok: true,
    save: {
      id: migrated.id,
      formatVersion: CURRENT_SAVE_FORMAT_VERSION,
      scenarioId: migrated.scenarioId,
      kind: migrated.kind as SaveKind,
      createdAt: migrated.createdAt,
      updatedAt: migrated.updatedAt,
      label: migrated.label as string | undefined,
      playthroughSeed: migrated.playthroughSeed,
      summary: migrated.summary as string | undefined,
      state: { game: state.game, ui: state.ui },
    },
  }
}

/** Full decode used before hydrating a save into the live stores: envelope + shape, *and* that the
 * save actually targets a scenario this build knows about. */
export function decodeSaveGame(value: unknown, knownScenarioIds: readonly string[]): SaveDecodeResult {
  const decoded = decodeSaveEnvelope(value)
  if (!decoded.ok) return decoded
  if (!knownScenarioIds.includes(decoded.save.scenarioId)) {
    return err('unknown-scenario', `Save targets an unknown scenario ("${decoded.save.scenarioId}").`)
  }
  return decoded
}

/** Inverse of `decodeSaveEnvelope` for the "parse untrusted JSON" half of the round trip — kept as
 * its own step (rather than folded into `decodeSaveGame`) so a malformed JSON *string* and a
 * well-formed-but-wrong-shaped *value* report distinct, narrow error types. */
export function parseSaveGameJson(raw: string): { ok: true; value: unknown } | { ok: false; error: SaveValidationError } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return err('invalid-json', 'Save data is not valid JSON.')
  }
}

export function encodeSaveGame(save: SaveGameV1): string {
  return JSON.stringify(save)
}

export function summariseSaveGame(save: SaveGameV1): SaveSummary {
  return {
    id: save.id,
    formatVersion: save.formatVersion,
    scenarioId: save.scenarioId,
    kind: save.kind,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    label: save.label,
    summary: save.summary,
    date: save.state.game.date,
    selectedPartyId: save.state.game.selectedPartyId,
  }
}
