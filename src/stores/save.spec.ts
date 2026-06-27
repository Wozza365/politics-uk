import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    game.runLeverAction('fundraising') // P2.9 party-lever change
    game.runLeverAction('socialMedia')
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

  it('restores campaign objective and arc progress part-way through a campaign', async () => {
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(new InMemorySaveRepository())

    game.startGame('labour')
    game.campaignArcs[0].status = 'active'
    game.campaignArcs[0].updatedAt = '2025-02-01'
    const expectedGameState = game.toSaveState()

    const metadata = await save.writeSave('manual', 'campaign progress')

    setActivePinia(createPinia())
    const freshGame = useGameStore()
    const freshSave = useSaveStore()
    freshSave.useRepository(save.repository)

    expect(await freshSave.loadSave(metadata.id)).toBe(true)
    expect(freshGame.toSaveState().campaignArcs).toEqual(expectedGameState.campaignArcs)
    expect(freshGame.toSaveState().campaignObjectives).toEqual(expectedGameState.campaignObjectives)
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

  it('startNewGame (P3.2) resets the game store and writes its first autosave before the caller proceeds', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)

    await save.startNewGame('labour')

    expect(game.selectedPartyId).toBe('labour')
    const autosave = await repository.read('autosave')
    expect(autosave).not.toBeNull()
    expect((autosave as SaveGameV1).state.game.selectedPartyId).toBe('labour')
  })

  it('startNewGame replaces a previous campaign\'s rolling autosave (the single global slot)', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)

    await save.startNewGame('labour')
    game.tickDay()
    await save.writeSave('autosave')

    await save.startNewGame('conservative')

    const autosave = (await repository.read('autosave')) as SaveGameV1
    expect(autosave.state.game.selectedPartyId).toBe('conservative')
    expect(autosave.state.game.date).toBe(game.date) // the fresh campaign's own start date
  })

  it('direct autosave writes clear stale write errors and update the saved timestamp', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    save.lastWriteError = 'previous write failed'

    const metadata = await save.writeSave('autosave')

    expect(save.lastWriteError).toBeNull()
    expect(save.lastSavedAt).toBe(metadata.updatedAt)
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

describe('useSaveStore — P3.1 autosave scheduler, manual slots, portable saves', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules an autosave after each required trigger point, coalescing a same-tick burst into one write', async () => {
    const repository = new InMemorySaveRepository()
    const writeSpy = vi.spyOn(repository, 'write')
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    save.startAutosave()
    writeSpy.mockClear() // startGame() isn't a trigger, but clear defensively

    game.tickDay()
    game.runLeverAction('fundraising')
    game.runLeverAction('socialMedia')
    expect(writeSpy).not.toHaveBeenCalled() // debounced, not written yet

    await vi.advanceTimersByTimeAsync(2000)
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(save.lastSavedAt).not.toBeNull()
    expect((await repository.read('autosave'))).not.toBeNull()
  })

  it('triggers on a resolved feed action and a resolved contest action', async () => {
    const repository = new InMemorySaveRepository()
    const writeSpy = vi.spyOn(repository, 'write')
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    save.startAutosave()
    writeSpy.mockClear()

    const event: GameEvent = {
      id: 'evt-autosave-trigger',
      headline: 'Test event',
      scope: 'regional',
      severity: 'moderate',
      weight: 1,
      actions: [{ id: 'respond', label: 'Respond' }],
    }
    game.pendingEvents.push(event)
    game.recordFeedEntry({ id: event.id, date: game.date, headline: event.headline, status: 'unactioned', actions: [{ id: 'respond', label: 'Respond' }] })
    game.resolveFeedAction(event.id, 'respond')
    await vi.advanceTimersByTimeAsync(2000)
    expect(writeSpy).toHaveBeenCalledTimes(1)

    writeSpy.mockClear()
    game.contests.push({
      id: 'byelection:commons:test-region:2025-01-02',
      contestTier: 'commons',
      regionId: 'test-region',
      geometryRef: 'test-region',
      seatName: 'Test Seat',
      incumbentParty: 'labour',
      calledDate: game.date,
      status: 'pending',
    })
    game.actionContest(game.contests[0].id, 'local_push')
    await vi.advanceTimersByTimeAsync(2000)
    expect(writeSpy).toHaveBeenCalledTimes(1)
  })

  it('does not write during hydration (loadSave/hydrateFromSaveState is not a trigger action)', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    game.tickDay()
    const metadata = await save.writeSave('manual', 'checkpoint')

    save.startAutosave()
    const writeSpy = vi.spyOn(repository, 'write')

    await save.loadSave(metadata.id)
    await vi.advanceTimersByTimeAsync(5000)

    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('startAutosave is idempotent — a second call does not double-subscribe', async () => {
    const repository = new InMemorySaveRepository()
    const writeSpy = vi.spyOn(repository, 'write')
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    save.startAutosave()
    save.startAutosave()
    writeSpy.mockClear()

    game.tickDay()
    await vi.advanceTimersByTimeAsync(2000)

    expect(writeSpy).toHaveBeenCalledTimes(1)
  })

  it('saveNow() flushes the debounced autosave immediately', async () => {
    const repository = new InMemorySaveRepository()
    const writeSpy = vi.spyOn(repository, 'write')
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    save.startAutosave()
    writeSpy.mockClear()

    game.tickDay()
    await save.saveNow()

    expect(writeSpy).toHaveBeenCalledTimes(1)
  })

  it('surfaces a failed autosave write as a recoverable error without throwing or losing the prior autosave', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    await save.writeSave('autosave') // a prior good autosave exists

    save.startAutosave()
    vi.spyOn(repository, 'write').mockRejectedValueOnce(new Error('storage quota exceeded'))

    game.tickDay()
    await vi.advanceTimersByTimeAsync(2000)

    expect(save.lastWriteError).toContain('storage quota exceeded')
    expect(await repository.read('autosave')).not.toBeNull() // prior autosave untouched
  })

  it('createManualSave writes a labelled, summarised manual slot distinct from the autosave', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')

    const metadata = await save.createManualSave('Before the by-election')

    expect(metadata.kind).toBe('manual')
    expect(metadata.id).not.toBe('autosave')
    expect(metadata.summary).toContain('Lab')
  })

  it('overwriteManualSave re-saves into the same slot, keeping id/createdAt but refreshing state/summary', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    const original = await save.createManualSave('Checkpoint')
    const originalRaw = (await repository.read(original.id)) as SaveGameV1

    game.tickDay()
    const updated = await save.overwriteManualSave(original.id)

    expect(updated?.id).toBe(original.id)
    expect(updated?.label).toBe('Checkpoint')
    const updatedRaw = (await repository.read(original.id)) as SaveGameV1
    expect(updatedRaw.createdAt).toBe(originalRaw.createdAt)
    expect(updatedRaw.state.game.date).not.toBe(originalRaw.state.game.date)
  })

  it('overwriteManualSave refuses to target the autosave slot', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    await save.writeSave('autosave')

    const result = await save.overwriteManualSave('autosave')

    expect(result).toBeNull()
  })

  it('renameManualSave updates only the label, leaving saved state untouched', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    const original = await save.createManualSave('Old name')

    const renamed = await save.renameManualSave(original.id, 'New name')

    expect(renamed).toBe(true)
    expect(save.saves.find((entry) => entry.id === original.id)?.label).toBe('New name')
  })

  it('deleteSave removes a manual slot', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    const manual = await save.createManualSave('Disposable')

    await save.deleteSave(manual.id)

    expect(await repository.read(manual.id)).toBeNull()
  })

  it('exports and re-imports a save round trip, restoring equivalent state under a manual slot', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    game.tickDay()
    const original = await save.createManualSave('Exportable')
    const exported = await save.exportSave(original.id)

    expect(exported).not.toBeNull()
    await save.deleteSave(original.id)

    const result = await save.importSave(exported!.json)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const imported = await repository.read(result.metadata.id)
      expect(imported).not.toBeNull()
      expect(result.metadata.kind).toBe('manual')
    }
  })

  it('importSave refuses to silently overwrite a duplicate id, then succeeds once confirmed', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    const original = await save.createManualSave('Original')
    const exported = await save.exportSave(original.id)

    const firstAttempt = await save.importSave(exported!.json)
    expect(firstAttempt.ok).toBe(false)
    if (!firstAttempt.ok && firstAttempt.reason === 'conflict') {
      expect(firstAttempt.conflict.pendingId).toBe(original.id)
    } else {
      throw new Error('expected a conflict result')
    }

    const confirmed = await save.importSave(exported!.json, { confirmOverwrite: true })
    expect(confirmed.ok).toBe(true)
  })

  it('importSave always lands as a manual slot, even when the exported record was the autosave', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')
    await save.writeSave('autosave')
    const exported = await save.exportSave('autosave')

    const result = await save.importSave(exported!.json, { confirmOverwrite: true })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.metadata.kind).toBe('manual')
    // the live autosave slot itself is untouched by the import
    const liveAutosave = (await repository.read('autosave')) as SaveGameV1
    expect(liveAutosave.kind).toBe('autosave')
  })

  it('importSave rejects malformed JSON without throwing', async () => {
    const repository = new InMemorySaveRepository()
    const game = useGameStore()
    const save = useSaveStore()
    save.useRepository(repository)
    game.startGame('labour')

    const result = await save.importSave('{ not valid json')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })
})
