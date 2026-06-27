import { describe, expect, it } from 'vitest'
import { resolveCommonsElection } from './commons'
import type { Region } from '@/types'

function region(id: string, holder: string, results: { party: string; voteShare: number }[]): Region {
  return {
    id,
    tier: 'commons',
    name: id,
    geometryRef: id,
    seats: [
      {
        regionId: id,
        party: holder,
        results: results.map((result) => ({ ...result, votes: 0 })),
      },
    ],
  }
}

describe('resolveCommonsElection', () => {
  const regions = [
    region('seat-a', 'labour', [
      { party: 'labour', voteShare: 45 },
      { party: 'conservative', voteShare: 35 },
    ]),
    region('seat-b', 'conservative', [
      { party: 'conservative', voteShare: 45 },
      { party: 'labour', voteShare: 35 },
    ]),
  ]

  it('returns one valid winner per eligible seat and reconciled counts', () => {
    const outcome = resolveCommonsElection({
      date: '2029-05-01',
      regions,
      startPolling: { labour: 35, conservative: 35 },
      currentPolling: { labour: 45, conservative: 25 },
      selectedPartyId: 'labour',
      majorityThreshold: 2,
    })

    expect(outcome.winners).toHaveLength(2)
    expect(Object.values(outcome.countsByParty).reduce((sum, count) => sum + count, 0)).toBe(2)
    expect(outcome.countsByParty.labour).toBe(2)
    expect(outcome.changesByParty.labour).toBe(1)
    expect(outcome.playerObjective).toBe('won')
  })

  it('lets a decisive local commitment override the national-swing winner', () => {
    const outcome = resolveCommonsElection({
      date: '2029-05-01',
      regions,
      startPolling: { labour: 35, conservative: 35 },
      currentPolling: { labour: 45, conservative: 25 },
      localInfluenceByRegion: { 'seat-a': { conservative: 0.7 } },
      selectedPartyId: 'labour',
      majorityThreshold: 2,
    })

    const seatA = outcome.winners.find((winner) => winner.regionId === 'seat-a')
    expect(seatA).toMatchObject({ winnerParty: 'conservative', source: 'local-commitment' })
    expect(outcome.countsByParty).toEqual({ conservative: 1, labour: 1 })
    expect(outcome.playerObjective).toBe('lost')
  })

  it('is deterministic for the same inputs', () => {
    const input = {
      date: '2029-05-01' as const,
      regions,
      startPolling: { labour: 35, conservative: 35 },
      currentPolling: { labour: 42, conservative: 28 },
      selectedPartyId: 'labour',
      majorityThreshold: 2,
    }

    expect(resolveCommonsElection(input)).toEqual(resolveCommonsElection(input))
  })
})
