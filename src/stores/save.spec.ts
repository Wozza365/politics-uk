import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './game'
import { useUiStore } from './ui'
import { useSaveStore } from './save'
import { InMemorySaveRepository } from '@/save/repository'
import type { GameEvent, SaveGameV1 } from '@/types'

function actionEvent(): GameEvent {
  return {
    id: 'evt-save-test',
    headline: 'A by-election is called',
    scope: 'regional',
    severity: 'moderate',
    weight: 1,
    actions: [{ id: 'campaign', label: 'Campaign hard', effects: { summary: 'A strong showing.' } }],
  }
}

describe('useSaveStore — P3.0 save contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('serialise -> write -> fresh stores -> load restores the same playable domain state', async () => {
    const game = useGameStore()
    const ui = useUiStore()
    const save = useSaveStore()
    save.useRepository(new InMemorySaveRepository())

    game.startGame('labour')
    game.tickDay()
    game.runFundraisingAppeal() // P2.9 party-lever change
    game.runSocialMediaCampaign()
    game.rollByElections() // P2.8 contest state

    // A representative queued-then-resolved action event, same pattern as the existing
    // `resolveFeedAction` tests use (rather than waiting on a probabilistic pool roll).
    const event = actionEvent()
    game.pendingEvents.push(event)
    game.recordFeedEntry({
      id: event.id,
      date: game.date,
      headline: event.headline,
      status: 'unactioned',
      actions: [{ id: 'campaign', label: 'Campaign hard' }],
    })
    game.resolveFeedAction(event.id, 'campaign')

    ui.setActiveView('regional')
    ui.setActiveCouncilLevel('county')
    ui.setWestminsterRenderer('hex')

    const expectedGameState = game.toSaveState()
    const expectedUiState = ui.toSaveState()
    const expectedSeed = game.playthroughSeed

    const metadata = await save.writeSave('manual', 'integration test save')
    expect(metadata.id).toBeTruthy()

    // A real reload re-creates every store from scratch — prove restoration doesn't depend on
    // any in-memory state the original stores happened to still be holding.
    setActivePinia(createPinia())
    const freshGame = useGameStore()
    const freshUi = useUiStore()
    const freshSave = useSaveStore()
    freshSave.useRepository(save.repository)

    const loaded = await freshSave.loadSave(metadata.id)

    expect(loaded).toBe(true)
    expect(freshSave.lastError).toBeNull()
    expect(freshGame.toSaveState()).toEqual(expectedGameState)
    expect(freshUi.toSaveState()).toEqual(expectedUiState)
    expect(freshGame.playthroughSeed).toBe(expectedSeed)
    expect(freshGame.clock.running).toBe(false) // restored game is always paused
  })

  it('continues deterministically after a restore: same next-tick outcome as the unsaved original', async () => {
    const repository = new InMemorySaveRepository()

    const liveGame = useGameStore()
    const liveSave = useSaveStore()
    liveSave.useRepository(repository)
    liveGame.startGame('labour')
    for (let day = 0; day < 10; day++) liveGame.tickDay()
    const metadata = await liveSave.writeSave('manual')
    liveGame.tickDay()
    const liveContinuation = liveGame.toSaveState()

    setActivePinia(createPinia())
    const restoredGame = useGameStore()
    const restoredSave = useSaveStore()
    restoredSave.useRepository(repository)
    await restoredSave.loadSave(metadata.id)
    restoredGame.tickDay()
    const restoredContinuation = restoredGame.toSaveState()

    expect(restoredContinuation).toEqual(liveContinuation)
  })

  it('rejects a corrupt record without crashing, touching the live game, or losing a good save', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    const goodSave = await save.writeSave('manual', 'good save')

    await repository.write({ id: 'corrupt', not: 'a valid save' } as unknown as SaveGameV1)
    const beforeLoad = game.toSaveState()

    const loaded = await save.loadSave('corrupt')

    expect(loaded).toBe(false)
    expect(save.lastError?.type).toBe('invalid-envelope')
    expect(game.toSaveState()).toEqual(beforeLoad)
    expect(await repository.read(goodSave.id)).not.toBeNull()
  })

  it('rejects a save from an unrecognised scenario id', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    await save.writeSave('manual')
    const raw = (await repository.read((await repository.list())[0].id)) as SaveGameV1
    await repository.write({ ...raw, id: 'other-scenario', scenarioId: 'not-a-real-scenario' })

    const loaded = await save.loadSave('other-scenario')

    expect(loaded).toBe(false)
    expect(save.lastError?.type).toBe('unknown-scenario')
  })

  it('rejects a save from a future, unsupported format version', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    await save.writeSave('manual')
    const raw = (await repository.read((await repository.list())[0].id)) as SaveGameV1
    await repository.write({ ...raw, id: 'future', formatVersion: (raw.formatVersion + 1) as 1 })

    const loaded = await save.loadSave('future')

    expect(loaded).toBe(false)
    expect(save.lastError?.type).toBe('unsupported-version')
  })

  it('clearAutosave removes only the autosave slot, leaving manual saves intact', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')

    await save.writeSave('autosave')
    const manual = await save.writeSave('manual', 'keep me')
    await save.clearAutosave()

    expect(await repository.read('autosave')).toBeNull()
    expect(await repository.read(manual.id)).not.toBeNull()
  })
})
