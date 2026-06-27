import { beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_SAVE_FORMAT_VERSION } from '@/types'
import type { SaveGameV1 } from '@/types'
import { InMemorySaveRepository } from './repository'

function buildSave(overrides: Partial<SaveGameV1> = {}): SaveGameV1 {
  return {
    id: 'save-1',
    formatVersion: CURRENT_SAVE_FORMAT_VERSION,
    scenarioId: 'uk-2025-01-01',
    kind: 'manual',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    playthroughSeed: 1,
    state: {
      game: {
        selectedPartyId: 'labour',
        date: '2025-02-01',
        clockMsPerDay: 15000,
        polling: { labour: 27.4 },
        pollingHistory: [],
        pendingPollImpacts: [],
        finance: {},
        membership: {},
        leverCooldowns: {},
        staffCapacityBonus: {},
        activeCommitments: [],
        feed: [],
        contests: [],
        pendingEventIds: [],
        firedEventIds: [],
        salience: {},
        result: null,
      },
      ui: { activeView: 'westminster', activeCouncilLevel: 'local', westminsterRenderer: 'geographic' },
    },
    ...overrides,
  }
}

describe('InMemorySaveRepository', () => {
  let repository: InMemorySaveRepository

  beforeEach(() => {
    repository = new InMemorySaveRepository()
  })

  it('write then read returns the same record', async () => {
    const save = buildSave()
    await repository.write(save)
    const raw = await repository.read('save-1')
    expect(raw).toEqual(save)
  })

  it('read returns null for an unknown id', async () => {
    expect(await repository.read('missing')).toBeNull()
  })

  it('write replaces a whole record and returns its metadata', async () => {
    await repository.write(buildSave({ label: 'first' }))
    const metadata = await repository.write(buildSave({ label: 'second' }))
    expect(metadata.label).toBe('second')
    const raw = (await repository.read('save-1')) as SaveGameV1
    expect(raw.label).toBe('second')
  })

  it('list surfaces summaries for every valid record, newest updatedAt first', async () => {
    await repository.write(buildSave({ id: 'a', updatedAt: '2025-01-01T00:00:00.000Z' }))
    await repository.write(buildSave({ id: 'b', updatedAt: '2025-03-01T00:00:00.000Z' }))
    const list = await repository.list()
    expect(list.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('list silently skips a corrupt record rather than throwing', async () => {
    await repository.write(buildSave({ id: 'good' }))
    // Reach past the typed `write` signature to simulate a record that was corrupted at rest.
    await repository.write({ id: 'bad', not: 'a valid save' } as unknown as SaveGameV1)
    const list = await repository.list()
    expect(list.map((s) => s.id)).toEqual(['good'])
  })

  it('remove deletes a record', async () => {
    await repository.write(buildSave())
    await repository.remove('save-1')
    expect(await repository.read('save-1')).toBeNull()
  })

  it('clearAutosave removes only autosave-kind records', async () => {
    await repository.write(buildSave({ id: 'auto', kind: 'autosave' }))
    await repository.write(buildSave({ id: 'manual-1', kind: 'manual' }))
    await repository.clearAutosave()
    expect(await repository.read('auto')).toBeNull()
    expect(await repository.read('manual-1')).not.toBeNull()
  })
})
