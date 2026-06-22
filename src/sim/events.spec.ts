import { describe, expect, it } from 'vitest'
import { eligibleEvents, resolvePollingEffects, rollEventForDay } from './events'
import type { GameEvent } from '@/types'

const windowed: GameEvent = {
  id: 'windowed',
  headline: 'Windowed event',
  scope: 'national',
  severity: 'major',
  weight: 5,
  window: { from: '2026-06-01', to: '2026-07-31' },
}

const ambient: GameEvent = {
  id: 'ambient',
  headline: 'Ambient event',
  scope: 'local',
  severity: 'minor',
  weight: 5,
}

describe('eligibleEvents', () => {
  it('excludes events outside their date window', () => {
    const pool = [windowed, ambient]
    expect(eligibleEvents(pool, '2025-01-01', []).map((e) => e.id)).toEqual(['ambient'])
    expect(eligibleEvents(pool, '2026-06-15', []).map((e) => e.id).sort()).toEqual(['ambient', 'windowed'])
    expect(eligibleEvents(pool, '2026-08-01', []).map((e) => e.id)).toEqual(['ambient'])
  })

  it('excludes already-fired once-only events, but keeps repeatable ones', () => {
    const repeatable: GameEvent = { ...ambient, id: 'repeatable', once: false }
    const pool = [ambient, repeatable]
    const eligible = eligibleEvents(pool, '2025-01-01', ['ambient', 'repeatable'])
    expect(eligible.map((e) => e.id)).toEqual(['repeatable'])
  })
})

describe('rollEventForDay', () => {
  it('is deterministic: the same date and fired-list always produces the same result', () => {
    const pool = [windowed, ambient]
    const first = rollEventForDay('2026-06-15', [], pool)
    const second = rollEventForDay('2026-06-15', [], pool)
    expect(first?.id).toBe(second?.id)
  })

  it('never returns an event outside its window', () => {
    const pool = [windowed]
    for (let day = 1; day <= 28; day++) {
      const date = `2025-02-${String(day).padStart(2, '0')}`
      expect(rollEventForDay(date, [], pool)).toBeNull()
    }
  })

  it('returns null once the pool is empty (e.g. every once-only event already fired)', () => {
    expect(rollEventForDay('2025-01-01', ['ambient'], [ambient])).toBeNull()
  })
})

describe('resolvePollingEffects', () => {
  const ctx = { selectedPartyId: 'labour', commonsSeatsByParty: { labour: 400, conservative: 200 } }

  it('resolves "player" to the selected party', () => {
    const impacts = resolvePollingEffects([{ partyId: 'player', magnitude: 0.1 }], ctx, 'test')
    expect(impacts).toEqual([{ partyId: 'labour', magnitude: 0.1, source: 'test' }])
  })

  it('resolves "incumbent" to the party with the most Commons seats', () => {
    const impacts = resolvePollingEffects([{ partyId: 'incumbent', magnitude: -0.2 }], ctx, 'test')
    expect(impacts).toEqual([{ partyId: 'labour', magnitude: -0.2, source: 'test' }])
  })

  it('passes concrete party ids through unchanged', () => {
    const impacts = resolvePollingEffects([{ partyId: 'reform', magnitude: 0.05 }], ctx, 'test')
    expect(impacts).toEqual([{ partyId: 'reform', magnitude: 0.05, source: 'test' }])
  })

  it('drops "player" effects when no party is selected', () => {
    const impacts = resolvePollingEffects(
      [{ partyId: 'player', magnitude: 0.1 }],
      { selectedPartyId: null, commonsSeatsByParty: {} },
      'test',
    )
    expect(impacts).toEqual([])
  })
})
