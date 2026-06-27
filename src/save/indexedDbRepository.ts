// Production `SaveRepository` (P3.0 decision: "Use IndexedDB as the production storage engine,
// isolated behind a `SaveRepository` interface"). Deliberately not unit-tested directly — there's
// no `indexedDB` global in the Vitest (Node) environment, and the contract explicitly calls for
// the in-memory repository to carry that weight (`save/repository.spec.ts`) since this class is a
// thin, directly-typed adapter onto the exact same `SaveRepository` interface. Exercise it via
// `npm run dev` once a UI is wired up to `stores/save.ts` (P3.1).
import type { SaveGameV1, SaveMetadata, SaveSummary } from '@/types'
import { decodeSaveEnvelope, summariseSaveGame } from './codec'
import type { SaveRepository } from './repository'

export const SAVE_DB_NAME = 'politics-uk-saves'
export const SAVE_DB_VERSION = 1
export const SAVE_STORE_NAME = 'saves'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVE_DB_NAME, SAVE_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SAVE_STORE_NAME)) {
        db.createObjectStore(SAVE_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
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

export class IndexedDbSaveRepository implements SaveRepository {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDatabase()
    return this.dbPromise
  }

  private async withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.getDb()
    const tx = db.transaction(SAVE_STORE_NAME, mode)
    return settle(run(tx.objectStore(SAVE_STORE_NAME)))
  }

  async list(): Promise<SaveSummary[]> {
    const all = await this.withStore('readonly', (store) => store.getAll())
    const summaries: SaveSummary[] = []
    for (const record of all) {
      const decoded = decodeSaveEnvelope(record)
      if (decoded.ok) summaries.push(summariseSaveGame(decoded.save))
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async read(id: string): Promise<unknown | null> {
    const result = await this.withStore('readonly', (store) => store.get(id))
    return result ?? null
  }

  async write(save: SaveGameV1): Promise<SaveMetadata> {
    await this.withStore('readwrite', (store) => store.put(save))
    return toMetadata(save)
  }

  async remove(id: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(id))
  }

  async clearAutosave(): Promise<void> {
    const all = await this.withStore('readonly', (store) => store.getAll())
    for (const record of all) {
      const decoded = decodeSaveEnvelope(record)
      if (decoded.ok && decoded.save.kind === 'autosave') await this.remove(decoded.save.id)
    }
  }
}
