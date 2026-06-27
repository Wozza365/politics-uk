import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { PartyId, SaveGameV1, SaveKind, SaveMetadata, SaveSummary, SaveValidationError } from '@/types'
import { CURRENT_SAVE_FORMAT_VERSION } from '@/types'
import {
  decodeSaveEnvelope,
  decodeSaveGame,
  encodeSaveGame,
  parseSaveGameJson,
  summariseSaveGame,
} from '@/save/codec'
import { IndexedDbSaveRepository } from '@/save/indexedDbRepository'
import type { SaveRepository } from '@/save/repository'
import { AutosaveScheduler, documentLifecycleSeam } from '@/save/autosave'
import { useGameStore } from './game'
import { useScenarioStore } from './scenario'
import { useUiStore } from './ui'

/** `game` domain actions that close a transaction worth checkpointing (P3.1 save policy) — a
 * burst of these within the scheduler's debounce window coalesces into one autosave write rather
 * than one per action. Deliberately excludes `hydrateFromSaveState`/`startGame` (no save-during-
 * hydration/fresh-start loop) and anything not yet wired to a "return to menu" action (P3.2). */
const AUTOSAVE_TRIGGER_ACTIONS = new Set([
  'tickDay',
  'resolveFeedAction',
  'actionContest',
  'runFundraisingAppeal',
  'runSocialMediaCampaign',
  'continuePlaying',
])

export interface ImportConflict {
  pendingId: string
  existing?: SaveSummary
}

export type ImportSaveResult =
  | { ok: true; metadata: SaveMetadata }
  | { ok: false; reason: 'invalid'; error: SaveValidationError }
  | { ok: false; reason: 'conflict'; conflict: ImportConflict }

/** Thumbnail-free one-line summary captured once at write time (save policy: manual-slot metadata
 * is immutable, never recomputed live) — e.g. "Labour 27.4% polling · £1,204,000 cash". */
function describeSaveSummary(game: ReturnType<typeof useGameStore>, scenario: ReturnType<typeof useScenarioStore>): string {
  const partyId = game.selectedPartyId
  if (!partyId) return game.date
  const partyName = scenario.party(partyId)?.shortName ?? partyId
  const pollingPct = game.polling[partyId]
  const cash = game.finance[partyId]?.estimatedCashOnHand
  const parts = [
    partyName,
    pollingPct !== undefined ? `${pollingPct.toFixed(1)}% polling` : null,
    cash !== undefined ? `£${Math.round(cash).toLocaleString('en-GB')} cash` : null,
  ].filter((part): part is string => !!part)
  return parts.join(' · ')
}

/** Narrow coordinator (P3.0/P3.1) between the game/ui stores and a `SaveRepository` — components
 * never talk to the repository (or IndexedDB) directly. Owns: which repository implementation is
 * live, the save list, the rolling-autosave scheduler, and the last recoverable load/write/import
 * error so a UI can surface it without the app crashing. */
export const useSaveStore = defineStore('save', {
  state: () => ({
    repository: markRaw(new IndexedDbSaveRepository()) as SaveRepository,
    saves: [] as SaveSummary[],
    selectedSaveId: null as string | null,
    lastError: null as SaveValidationError | null,
    scheduler: null as AutosaveScheduler | null,
    saving: false,
    lastSavedAt: null as string | null,
    lastWriteError: null as string | null,
  }),
  actions: {
    /** Test/integration seam — swaps in an `InMemorySaveRepository` (or any other implementation)
     * without touching IndexedDB. Production code never needs to call this. */
    useRepository(repository: SaveRepository) {
      this.repository = markRaw(repository)
    },
    async refreshSaves() {
      this.saves = await this.repository.list()
    },
    /** P3.2's single orchestration entry point for starting a brand-new campaign: resets every
     * mutable store via `game.startGame`, then writes its first autosave before the caller's first
     * playable frame (save policy: "queue an autosave only after a domain transaction completes" —
     * starting a fresh campaign is one). Confirming an overwrite of an existing active campaign is
     * the caller's job (`ui.requestConfirm`, since the single rolling autosave slot means a new
     * campaign's first write would otherwise silently replace the previous one) — this action
     * assumes that's already happened. */
    async startNewGame(partyId: PartyId): Promise<void> {
      const game = useGameStore()
      game.startGame(partyId)
      await this.writeSave('autosave')
    },
    /** Snapshots the live game/ui stores into a complete, self-validated record and writes it in
     * one repository call — never a partial one ("atomic-replacement strategy appropriate to
     * IndexedDB": construct + validate fully before ever touching storage, so a bug here can't
     * leave a half-written record behind). `kind: 'autosave'` always targets the fixed `'autosave'`
     * slot id; passing `existing` re-saves into a specific id/createdAt instead of minting a new
     * manual slot (`overwriteManualSave`). */
    async writeSave(kind: SaveKind, label?: string, existing?: { id: string; createdAt: string }): Promise<SaveMetadata> {
      const game = useGameStore()
      const ui = useUiStore()
      const scenario = useScenarioStore()
      const now = new Date().toISOString()

      const save: SaveGameV1 = {
        id: existing?.id ?? (kind === 'autosave' ? 'autosave' : crypto.randomUUID()),
        formatVersion: CURRENT_SAVE_FORMAT_VERSION,
        scenarioId: scenario.scenario.id,
        kind,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        label,
        playthroughSeed: game.playthroughSeed,
        summary: describeSaveSummary(game, scenario),
        state: { game: game.toSaveState(), ui: ui.toSaveState() },
      }

      const validated = decodeSaveEnvelope(save)
      if (!validated.ok) throw new Error(`Refused to write an invalid save record: ${validated.error.message}`)

      try {
        const metadata = await this.repository.write(save)
        await this.refreshSaves()
        this.selectedSaveId = metadata.id
        this.lastWriteError = null
        if (kind === 'autosave') this.lastSavedAt = metadata.updatedAt
        return metadata
      } catch (error: unknown) {
        this.lastWriteError = error instanceof Error ? error.message : String(error)
        throw error
      }
    },
    /** Reads, decodes, and hydrates a save into the live game/ui stores. Returns `false` (and sets
     * `lastError`) on a corrupt/obsolete/unrecognised-scenario record instead of throwing — the
     * existing live game and any other save are left untouched either way. */
    async loadSave(id: string): Promise<boolean> {
      const scenario = useScenarioStore()
      const raw = await this.repository.read(id)
      const decoded = decodeSaveGame(raw, [scenario.scenario.id])
      if (!decoded.ok) {
        this.lastError = decoded.error
        return false
      }

      const game = useGameStore()
      const ui = useUiStore()
      game.hydrateFromSaveState(decoded.save.state.game)
      // `playthroughSeed` is metadata (sibling to `state`, not part of it — see `SaveMetadata`'s
      // header comment), so it's restored here rather than inside `hydrateFromSaveState`.
      game.playthroughSeed = decoded.save.playthroughSeed
      ui.hydrateFromSaveState(decoded.save.state.ui)
      this.selectedSaveId = id
      this.lastError = null
      return true
    },
    async deleteSave(id: string) {
      await this.repository.remove(id)
      if (this.selectedSaveId === id) this.selectedSaveId = null
      await this.refreshSaves()
    },
    async clearAutosave() {
      await this.repository.clearAutosave()
      await this.refreshSaves()
    },

    /** Wires the rolling autosave scheduler to the game store's completed domain actions and to
     * the page-visibility/pagehide seam. Idempotent — call once (from `App.vue`); a second call is
     * a no-op so a remount can't double-subscribe or run two schedulers. */
    startAutosave() {
      if (this.scheduler) return
      const game = useGameStore()
      const scheduler = new AutosaveScheduler({
        write: () => this.writeSave('autosave').then(() => undefined),
        seam: documentLifecycleSeam,
        onStatusChange: (status) => {
          this.saving = status.state === 'saving'
          this.lastWriteError = status.state === 'error' ? status.error : null
          if (status.state === 'saved') this.lastSavedAt = status.lastSavedAt
        },
      })
      // `true` (detached): this is wired once for the app's lifetime, not bound to whichever
      // component happened to call `startAutosave()`.
      game.$onAction(({ name, after }) => {
        if (!AUTOSAVE_TRIGGER_ACTIONS.has(name)) return
        after(() => scheduler.schedule())
      }, true)
      this.scheduler = markRaw(scheduler)
    },
    /** Player-facing "save now": flushes the autosave scheduler immediately rather than waiting
     * out its debounce window. Falls back to a direct write if the scheduler hasn't started yet
     * (e.g. in a test that exercises `writeSave` without `startAutosave`). */
    async saveNow() {
      if (this.scheduler) {
        await this.scheduler.flush()
        return
      }
      await this.writeSave('autosave')
    },
    async createManualSave(label: string): Promise<SaveMetadata> {
      return this.writeSave('manual', label)
    },
    /** Re-saves the live game into an existing manual slot, keeping its id/label/createdAt — the
     * panel's "Save" action on an already-named slot, distinct from `createManualSave`'s "always a
     * fresh slot". Returns `null` if `id` isn't a manual save this build recognises. */
    async overwriteManualSave(id: string): Promise<SaveMetadata | null> {
      const raw = await this.repository.read(id)
      const decoded = decodeSaveEnvelope(raw)
      if (!decoded.ok || decoded.save.kind !== 'manual') return null
      return this.writeSave('manual', decoded.save.label, { id, createdAt: decoded.save.createdAt })
    },
    /** Updates only a manual save's editable label, leaving its saved campaign state and
     * immutable metadata (scenario/party/date/summary) untouched. Returns `false` if `id` isn't a
     * manual save this build recognises. */
    async renameManualSave(id: string, label: string): Promise<boolean> {
      const raw = await this.repository.read(id)
      const decoded = decodeSaveEnvelope(raw)
      if (!decoded.ok || decoded.save.kind !== 'manual') return false
      const renamed: SaveGameV1 = { ...decoded.save, label, updatedAt: new Date().toISOString() }
      await this.repository.write(renamed)
      await this.refreshSaves()
      return true
    },
    /** Encodes a save record for download — the caller (a component) is responsible for turning
     * the returned JSON text into an actual file download; this store never touches the DOM. */
    async exportSave(id: string): Promise<{ filename: string; json: string } | null> {
      const raw = await this.repository.read(id)
      const decoded = decodeSaveEnvelope(raw)
      if (!decoded.ok) return null
      return { filename: `politics-uk-${decoded.save.kind}-${decoded.save.id}.json`, json: encodeSaveGame(decoded.save) }
    },
    /** Decodes untrusted JSON text through the same validator a load does (never trusts an
     * arbitrary prototype — `decodeSaveEnvelope` only ever copies named, type-checked fields into a
     * fresh object). Always imports as a manual slot — an imported `autosave` record must never
     * silently become *this* playthrough's rolling autosave. Refuses to overwrite an id already in
     * storage unless `confirmOverwrite` is set, so the caller can show a confirmation dialog and
     * retry once the player agrees. */
    async importSave(jsonText: string, opts: { confirmOverwrite?: boolean } = {}): Promise<ImportSaveResult> {
      const scenario = useScenarioStore()
      const parsed = parseSaveGameJson(jsonText)
      if (!parsed.ok) return { ok: false, reason: 'invalid', error: parsed.error }
      const decoded = decodeSaveGame(parsed.value, [scenario.scenario.id])
      if (!decoded.ok) return { ok: false, reason: 'invalid', error: decoded.error }

      // An exported autosave keeps its original id ('autosave') — re-importing it must never
      // collide with (and silently overwrite) *this* playthrough's live autosave slot.
      const importedId = decoded.save.id === 'autosave' ? crypto.randomUUID() : decoded.save.id
      const imported: SaveGameV1 = { ...decoded.save, id: importedId, kind: 'manual' }
      const existingRaw = await this.repository.read(imported.id)
      if (existingRaw && !opts.confirmOverwrite) {
        const existingDecoded = decodeSaveEnvelope(existingRaw)
        return {
          ok: false,
          reason: 'conflict',
          conflict: {
            pendingId: imported.id,
            existing: existingDecoded.ok ? summariseSaveGame(existingDecoded.save) : undefined,
          },
        }
      }

      const metadata = await this.repository.write(imported)
      await this.refreshSaves()
      this.selectedSaveId = metadata.id
      return { ok: true, metadata }
    },
  },
})
