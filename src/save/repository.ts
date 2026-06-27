// `SaveRepository` is the one persistence boundary `stores/save.ts` is allowed to talk to —
// components never reach into storage directly. `read()` returns whatever was actually in
// storage, untyped, because storage can hold a corrupt or obsolete record; callers run it through
// `save/codec.ts`'s `decodeSaveGame`/`decodeSaveEnvelope` before trusting it. `write()` takes an
// already-valid `SaveGameV1` — building and validating one is the caller's job.
import type { SaveGameV1, SaveMetadata, SaveSummary } from '@/types'
import { decodeSaveEnvelope, summariseSaveGame } from './codec'

export interface SaveRepository {
  list(): Promise<SaveSummary[]>
  read(id: string): Promise<unknown | null>
  write(save: SaveGameV1): Promise<SaveMetadata>
  remove(id: string): Promise<void>
  clearAutosave(): Promise<void>
}

function toMetadata(save: SaveGameV1): SaveMetadata {
  return {
    id: save.id,
    formatVersion: save.formatVersion,
    scenarioId: save.scenarioId,
    kind: save.kind,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    label: save.label,
    playthroughSeed: save.playthroughSeed,
    summary: save.summary,
  }
}

/** In-memory `SaveRepository` — same semantics as `IndexedDbSaveRepository`, minus persistence
 * across reloads. The repository tests exercise this implementation; the IndexedDB one is a thin,
 * directly-typed adapter onto the same interface (see that module's header for why it isn't
 * separately unit-tested). */
export class InMemorySaveRepository implements SaveRepository {
  private records = new Map<string, unknown>()

  async list(): Promise<SaveSummary[]> {
    const summaries: SaveSummary[] = []
    for (const record of this.records.values()) {
      const decoded = decodeSaveEnvelope(record)
      if (decoded.ok) summaries.push(summariseSaveGame(decoded.save))
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async read(id: string): Promise<unknown | null> {
    return this.records.has(id) ? this.records.get(id) : null
  }

  async write(save: SaveGameV1): Promise<SaveMetadata> {
    this.records.set(save.id, save)
    return toMetadata(save)
  }

  async remove(id: string): Promise<void> {
    this.records.delete(id)
  }

  async clearAutosave(): Promise<void> {
    for (const [id, record] of this.records) {
      const decoded = decodeSaveEnvelope(record)
      if (decoded.ok && decoded.save.kind === 'autosave') this.records.delete(id)
    }
  }
}
