import { describe, expect, it } from 'vitest'
import { computeDifficulty } from './difficulty'
import type { Party, Scenario } from '@/types'

function makeParty(id: string): Party {
  return {
    id,
    name: id,
    shortName: id,
    colours: { primary: '#000000', onPrimary: '#FFFFFF' },
    scope: 'national',
    leadership: [],
  }
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test',
    date: '2025-01-01',
    label: 'Test',
    tiers: { commons: [] },
    parties: [],
    polling: {},
    finances: {},
    membership: {},
    ...overrides,
  }
}

function commonsRegion(id: string, partyId: string) {
  return {
    id,
    tier: 'commons',
    name: id,
    geometryRef: id,
    seats: [{ regionId: id, party: partyId }],
  }
}

describe('computeDifficulty', () => {
  it('scores a large governing-ish party easier than a tiny fringe party', () => {
    const bigParty = makeParty('big')
    const tinyParty = makeParty('tiny')

    const commons = [
      ...Array.from({ length: 60 }, (_, i) => commonsRegion(`big-${i}`, 'big')),
      commonsRegion('tiny-0', 'tiny'),
      ...Array.from({ length: 39 }, (_, i) => commonsRegion(`other-${i}`, 'other')),
    ]

    const scenario = makeScenario({
      tiers: { commons },
      polling: { big: 40, tiny: 1, other: 30 },
    })

    const bigBand = computeDifficulty(bigParty, scenario)
    const tinyBand = computeDifficulty(tinyParty, scenario)

    expect(bigBand).toBeLessThan(tinyBand)
  })

  it('never exceeds band 5, even for a party with zero polling and zero seats', () => {
    const ghostParty = makeParty('ghost')
    const scenario = makeScenario({
      tiers: { commons: [commonsRegion('seat-0', 'someone_else')] },
      polling: { someone_else: 100 },
    })

    expect(computeDifficulty(ghostParty, scenario)).toBe(5)
  })

  it('always returns a band within the 1-5 range', () => {
    const party = makeParty('mid')
    const commons = Array.from({ length: 10 }, (_, i) => commonsRegion(`r-${i}`, i < 5 ? 'mid' : 'other'))
    const scenario = makeScenario({
      tiers: { commons },
      polling: { mid: 50 },
    })

    const band = computeDifficulty(party, scenario)
    expect(band).toBeGreaterThanOrEqual(1)
    expect(band).toBeLessThanOrEqual(5)
  })
})
