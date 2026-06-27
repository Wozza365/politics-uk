import { describe, expect, it } from 'vitest'
import { CURRENT_SAVE_FORMAT_VERSION } from '@/types'
import type { SaveGameV1 } from '@/types'
import { decodeSaveEnvelope, decodeSaveGame, encodeSaveGame, parseSaveGameJson, summariseSaveGame } from './codec'

function validSave(overrides: Partial<SaveGameV1> = {}): SaveGameV1 {
  return {
    id: 'save-1',
    formatVersion: CURRENT_SAVE_FORMAT_VERSION,
    scenarioId: 'uk-2025-01-01',
    kind: 'manual',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    label: 'Before the by-election',
    playthroughSeed: 12345,
    state: {
      game: {
        selectedPartyId: 'labour',
        date: '2025-02-01',
        clockMsPerDay: 15000,
        polling: { labour: 27.4 },
        pollingHistory: [{ date: '2025-01-01', polling: { labour: 26.2 } }],
        pendingPollImpacts: [{ partyId: 'labour', magnitude: 0.1, source: 'event:x' }],
        finance: { labour: { estimatedCashOnHand: 1000, source: 'estimated' } },
        membership: { labour: 5000 },
        leverCooldowns: { 'labour:fundraising': '2025-01-20' },
        feed: [{ id: 'f1', date: '2025-01-15', headline: 'Something happened.', status: 'actioned' }],
        contests: [
          {
            id: 'byelection:commons:E1:2025-01-10',
            contestTier: 'commons',
            regionId: 'E1',
            geometryRef: 'E1',
            seatName: 'Testford',
            incumbentParty: 'labour',
            calledDate: '2025-01-10',
            status: 'pending',
          },
        ],
        pendingEventIds: ['evt-1'],
        firedEventIds: ['evt-0'],
        salience: { economy: 0.5 },
        result: null,
      },
      ui: {
        activeView: 'westminster',
        activeCouncilLevel: 'local',
        westminsterRenderer: 'geographic',
      },
    },
    ...overrides,
  }
}

describe('parseSaveGameJson', () => {
  it('parses well-formed JSON', () => {
    const result = parseSaveGameJson('{"a":1}')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ a: 1 })
  })

  it('reports invalid-json on malformed input rather than throwing', () => {
    const result = parseSaveGameJson('{not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.type).toBe('invalid-json')
  })
})

describe('decodeSaveEnvelope / decodeSaveGame', () => {
  it('round-trips a well-formed save: encode -> parse -> decode equals the original', () => {
    const save = validSave()
    const parsed = parseSaveGameJson(encodeSaveGame(save))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const decoded = decodeSaveGame(parsed.value, ['uk-2025-01-01'])
    expect(decoded.ok).toBe(true)
    if (decoded.ok) expect(decoded.save).toEqual(save)
  })

  it('rejects a save targeting an unrecognised scenario', () => {
    const decoded = decodeSaveGame(validSave({ scenarioId: 'some-other-scenario' }), ['uk-2025-01-01'])
    expect(decoded.ok).toBe(false)
    if (!decoded.ok) expect(decoded.error.type).toBe('unknown-scenario')
  })

  it('decodeSaveEnvelope does not check scenario id (used for listing across scenarios)', () => {
    const decoded = decodeSaveEnvelope(validSave({ scenarioId: 'some-other-scenario' }))
    expect(decoded.ok).toBe(true)
  })

  it('rejects a save from a future, unsupported format version', () => {
    const decoded = decodeSaveGame({ ...validSave(), formatVersion: CURRENT_SAVE_FORMAT_VERSION + 1 }, ['uk-2025-01-01'])
    expect(decoded.ok).toBe(false)
    if (!decoded.ok) expect(decoded.error.type).toBe('unsupported-version')
  })

  it('rejects a non-object value as an invalid envelope', () => {
    const decoded = decodeSaveGame('not a save', ['uk-2025-01-01'])
    expect(decoded.ok).toBe(false)
    if (!decoded.ok) expect(decoded.error.type).toBe('invalid-envelope')
  })

  it('rejects a save missing required metadata fields', () => {
    const broken = validSave() as unknown as Record<string, unknown>
    delete broken.createdAt
    const decoded = decodeSaveGame(broken, ['uk-2025-01-01'])
    expect(decoded.ok).toBe(false)
    if (!decoded.ok) expect(decoded.error.type).toBe('invalid-envelope')
  })

  it('rejects a save with a corrupt state payload (wrong type for a required field)', () => {
    const save = validSave()
    const corrupt = { ...save, state: { ...save.state, game: { ...save.state.game, contests: 'not-an-array' } } }
    const decoded = decodeSaveGame(corrupt, ['uk-2025-01-01'])
    expect(decoded.ok).toBe(false)
    if (!decoded.ok) expect(decoded.error.type).toBe('corrupt-state')
  })

  it('does not crash on deeply malformed/garbage input', () => {
    expect(() => decodeSaveGame({ formatVersion: 1, state: null }, ['uk-2025-01-01'])).not.toThrow()
    expect(() => decodeSaveGame(null, ['uk-2025-01-01'])).not.toThrow()
    expect(() => decodeSaveGame(42, ['uk-2025-01-01'])).not.toThrow()
  })
})

describe('summariseSaveGame', () => {
  it('projects the load-screen-relevant fields without the full state payload', () => {
    const save = validSave()
    const summary = summariseSaveGame(save)
    expect(summary).toEqual({
      id: 'save-1',
      formatVersion: CURRENT_SAVE_FORMAT_VERSION,
      scenarioId: 'uk-2025-01-01',
      kind: 'manual',
      createdAt: save.createdAt,
      updatedAt: save.updatedAt,
      label: 'Before the by-election',
      date: '2025-02-01',
      selectedPartyId: 'labour',
    })
  })
})
