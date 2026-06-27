import { describe, expect, it } from 'vitest'
import {
  isOpponentCadenceDay,
  marginalityScore,
  MAX_NEW_COMMITMENTS_PER_CADENCE,
  OPPONENT_CADENCE_DAYS,
  rankTargetingMoves,
  selectOpponentMove,
} from './opponents'
import type { OpponentMoveCandidate } from './opponents'
import type { Region, Seat, TargetScope } from '@/types'

function seat(overrides: Partial<Seat> = {}): Seat {
  return {
    regionId: 'E14000001',
    party: 'labour',
    majority: 1_000,
    electorate: 50_000,
    ...overrides,
  }
}

function region(overrides: Partial<Region> = {}): Region {
  return {
    id: 'E14000001',
    tier: 'commons',
    name: 'Test Seat',
    geometryRef: 'E14000001',
    seats: [seat()],
    ...overrides,
  }
}

describe('marginalityScore', () => {
  it('returns null when the seat lacks a majority or electorate figure', () => {
    expect(marginalityScore(seat({ majority: undefined }))).toBeNull()
    expect(marginalityScore(seat({ electorate: undefined }))).toBeNull()
    expect(marginalityScore(seat({ electorate: 0 }))).toBeNull()
  })

  it('returns the majority as a share of the electorate, capped at 1', () => {
    expect(marginalityScore(seat({ majority: 5_000, electorate: 50_000 }))).toBe(0.1)
    expect(marginalityScore(seat({ majority: 60_000, electorate: 50_000 }))).toBe(1)
  })
})

describe('isOpponentCadenceDay', () => {
  it('is true on the scenario start date and every cadence multiple after it', () => {
    expect(isOpponentCadenceDay('2025-01-01', '2025-01-01')).toBe(true)
    expect(isOpponentCadenceDay('2025-01-01', '2025-01-08')).toBe(true)
    expect(OPPONENT_CADENCE_DAYS).toBe(7)
  })

  it('is false on every other day', () => {
    expect(isOpponentCadenceDay('2025-01-01', '2025-01-02')).toBe(false)
    expect(isOpponentCadenceDay('2025-01-01', '2025-01-07')).toBe(false)
  })
})

describe('rankTargetingMoves', () => {
  it('marks a seat the party already holds as a defend move', () => {
    const regions = [region({ id: 'A', name: 'Held Seat', seats: [seat({ party: 'labour', majority: 1_000, electorate: 50_000 })] })]
    const [candidate] = rankTargetingMoves('labour', regions, new Set())
    expect(candidate.reason).toBe('defend')
    expect(candidate.scope).toEqual({ kind: 'seat', regionId: 'A', label: 'Held Seat' })
    expect(candidate.rationale).toBe('Held Seat is a marginal hold (defending it).')
  })

  it('marks a seat held by someone else as a pursue move', () => {
    const regions = [region({ id: 'B', name: 'Rival Seat', seats: [seat({ party: 'conservative', majority: 1_000, electorate: 50_000 })] })]
    const [candidate] = rankTargetingMoves('labour', regions, new Set())
    expect(candidate.reason).toBe('pursue')
    expect(candidate.rationale).toBe('Rival Seat is a marginal seat held by conservative (a plausible gain).')
  })

  it('marks a seat the player is already campaigning in as a respond move, appending the player-focus note', () => {
    const regions = [region({ id: 'C', name: 'Contested Seat', seats: [seat({ party: 'conservative', majority: 1_000, electorate: 50_000 })] })]
    const [candidate] = rankTargetingMoves('labour', regions, new Set(['C']))
    expect(candidate.reason).toBe('respond')
    expect(candidate.rationale).toBe('Contested Seat is a marginal seat held by conservative (a plausible gain). The player is active there too.')
  })

  it('excludes seats lacking the data a marginality read needs', () => {
    const regions = [region({ id: 'D', seats: [seat({ majority: undefined })] }), region({ id: 'E', seats: [] })]
    expect(rankTargetingMoves('labour', regions, new Set())).toEqual([])
  })

  it('scores a more marginal seat higher than a safer one of the same reason', () => {
    const regions = [
      region({ id: 'SAFE', name: 'Safe Seat', seats: [seat({ party: 'labour', majority: 20_000, electorate: 50_000 })] }),
      region({ id: 'MARGINAL', name: 'Marginal Seat', seats: [seat({ party: 'labour', majority: 500, electorate: 50_000 })] }),
    ]
    const ranked = rankTargetingMoves('labour', regions, new Set())
    expect(ranked.map((c) => c.scope.regionId)).toEqual(['MARGINAL', 'SAFE'])
  })

  it('ranks a respond move above an equally marginal seat with no player focus', () => {
    const regions = [
      region({ id: 'IGNORED', name: 'Ignored Seat', seats: [seat({ party: 'conservative', majority: 1_000, electorate: 50_000 })] }),
      region({ id: 'FOCUSED', name: 'Focused Seat', seats: [seat({ party: 'conservative', majority: 1_000, electorate: 50_000 })] }),
    ]
    const ranked = rankTargetingMoves('labour', regions, new Set(['FOCUSED']))
    expect(ranked[0].scope.regionId).toBe('FOCUSED')
    expect(ranked[0].reason).toBe('respond')
  })

  it('breaks score ties on region id for a stable order', () => {
    const regions = [
      region({ id: 'Z', name: 'Z Seat', seats: [seat({ party: 'labour', majority: 1_000, electorate: 50_000 })] }),
      region({ id: 'A', name: 'A Seat', seats: [seat({ party: 'labour', majority: 1_000, electorate: 50_000 })] }),
    ]
    const ranked = rankTargetingMoves('labour', regions, new Set())
    expect(ranked.map((c) => c.scope.regionId)).toEqual(['A', 'Z'])
  })
})

describe('selectOpponentMove', () => {
  function candidate(regionId: string, score: number): OpponentMoveCandidate {
    const scope: TargetScope = { kind: 'seat', regionId, label: regionId }
    return { scope, reason: 'pursue', score, rationale: regionId }
  }

  it('returns the first affordable candidate in ranked order', () => {
    const candidates = [candidate('A', 0.9), candidate('B', 0.5)]
    const result = selectOpponentMove(candidates, () => true)
    expect(result?.scope.regionId).toBe('A')
  })

  it('skips an unaffordable top choice and falls through to the next affordable one', () => {
    const candidates = [candidate('A', 0.9), candidate('B', 0.5)]
    const result = selectOpponentMove(candidates, (scope) => scope.regionId === 'B')
    expect(result?.scope.regionId).toBe('B')
  })

  it('returns null when nothing is affordable, preserving scarce resources', () => {
    const candidates = [candidate('A', 0.9), candidate('B', 0.5)]
    expect(selectOpponentMove(candidates, () => false)).toBeNull()
  })

  it('returns null for an empty candidate list', () => {
    expect(selectOpponentMove([], () => true)).toBeNull()
  })

  it('caps new commitments per cadence tick at the configured constant', () => {
    expect(MAX_NEW_COMMITMENTS_PER_CADENCE).toBe(1)
  })
})
