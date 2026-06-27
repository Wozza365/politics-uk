import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { SaveGameV1, SaveKind, SaveMetadata, SaveSummary, SaveValidationError } from '@/types'
import { CURRENT_SAVE_FORMAT_VERSION } from '@/types'
import { decodeSaveGame } from '@/save/codec'
import { IndexedDbSaveRepository } from '@/save/indexedDbRepository'
import type { SaveRepository } from '@/save/repository'
import { useGameStore } from './game'
import { useScenarioStore } from './scenario'
import { useUiStore } from './ui'

/** Narrow coordinator (P3.0) between the game/ui stores and a `SaveRepository` — components never
 * talk to the repository (or IndexedDB) directly. Owns: which repository implementation is live,
 * the save list for a future load screen, the currently-selected save, and the last recoverable
 * load/save error so a UI can surface it without the app crashing. */
export const useSaveStore = defineStore('save', {
  state: () => ({
    repository: markRaw(new IndexedDbSaveRepository()) as SaveRepository,
    saves: [] as SaveSummary[],
    selectedSaveId: null as string | null,
    lastError: null as SaveValidationError | null,
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
    /** Snapshots the live game/ui stores and writes a new save record. `kind: 'autosave'` always
     * writes to the fixed `'autosave'` slot id (P3.1 owns the rest of the autosave-slot
     * lifecycle); `kind: 'manual'` gets a fresh id every time. */
    async writeSave(kind: SaveKind, label?: string): Promise<SaveMetadata> {
      const game = useGameStore()
      const ui = useUiStore()
      const scenario = useScenarioStore()
      const now = new Date().toISOString()

      const save: SaveGameV1 = {
        id: kind === 'autosave' ? 'autosave' : crypto.randomUUID(),
        formatVersion: CURRENT_SAVE_FORMAT_VERSION,
        scenarioId: scenario.scenario.id,
        kind,
        createdAt: now,
        updatedAt: now,
        label,
        playthroughSeed: game.playthroughSeed,
        state: { game: game.toSaveState(), ui: ui.toSaveState() },
      }

      const metadata = await this.repository.write(save)
      await this.refreshSaves()
      this.selectedSaveId = metadata.id
      return metadata
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
    async removeSave(id: string) {
      await this.repository.remove(id)
      if (this.selectedSaveId === id) this.selectedSaveId = null
      await this.refreshSaves()
    },
    async clearAutosave() {
      await this.repository.clearAutosave()
      await this.refreshSaves()
    },
  },
})
