import { describe, expect, it } from 'vitest'
import { computeDifficulty } from './difficulty'
import type { Party, Scenario } from '@/types'

function makeParty(id: string, scope: Party['scope'] = 'national'): Party {
  return {
    id,
    name: id,
    shortName: id,
    colours: { primary: '#000000', onPrimary: '#FFFFFF' },
    scope,
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
  it('ranks a large governing-ish party easier than a tiny fringe party', () => {
    const bigParty = makeParty('big')
    const tinyParty = makeParty('tiny')
    const otherParty = makeParty('other')

    const commons = [
      ...Array.from({ length: 60 }, (_, i) => commonsRegion(`big-${i}`, 'big')),
      commonsRegion('tiny-0', 'tiny'),
      ...Array.from({ length: 39 }, (_, i) => commonsRegion(`other-${i}`, 'other')),
    ]

    const scenario = makeScenario({
      tiers: { commons },
      parties: [bigParty, tinyParty, otherParty],
      polling: { big: 40, tiny: 1, other: 30 },
    })

    const bigBand = computeDifficulty(bigParty, scenario)
    const tinyBand = computeDifficulty(tinyParty, scenario)

    expect(bigBand).toBeLessThan(tinyBand)
  })

  it('puts the dominant party of the field in band 1 ("Easy")', () => {
    const dominant = makeParty('dominant')
    const rest = [makeParty('b'), makeParty('c'), makeParty('d')]

    const commons = [
      ...Array.from({ length: 60 }, (_, i) => commonsRegion(`dominant-${i}`, 'dominant')),
      ...Array.from({ length: 40 }, (_, i) => commonsRegion(`b-${i}`, 'b')),
    ]

    const scenario = makeScenario({
      tiers: { commons },
      parties: [dominant, ...rest],
      polling: { dominant: 45, b: 25, c: 10, d: 2 },
    })

    expect(computeDifficulty(dominant, scenario)).toBe(1)
  })

  it('never exceeds band 5, even for a party with zero polling and zero seats', () => {
    const ghostParty = makeParty('ghost')
    const someoneElse = makeParty('someone_else')
    const scenario = makeScenario({
      tiers: { commons: [commonsRegion('seat-0', 'someone_else')] },
      parties: [ghostParty, someoneElse],
      polling: { someone_else: 100 },
    })

    expect(computeDifficulty(ghostParty, scenario)).toBe(5)
  })

  it('excludes regional-scope parties from the ranking field', () => {
    const nationalParty = makeParty('national_party')
    const regionalLeader = makeParty('regional_leader', 'regional')

    const commons = [
      commonsRegion('seat-0', 'national_party'),
      ...Array.from({ length: 100 }, (_, i) => commonsRegion(`regional-${i}`, 'regional_leader')),
    ]

    const scenario = makeScenario({
      tiers: { commons },
      parties: [nationalParty, regionalLeader],
      polling: { national_party: 5, regional_leader: 50 },
    })

    // Sole national-scope party in the field, so it ranks first regardless
    // of the (excluded) regional party's dominance.
    expect(computeDifficulty(nationalParty, scenario)).toBe(1)
  })

  it('always returns a band within the 1-5 range', () => {
    const party = makeParty('mid')
    const other = makeParty('other')
    const commons = Array.from({ length: 10 }, (_, i) => commonsRegion(`r-${i}`, i < 5 ? 'mid' : 'other'))
    const scenario = makeScenario({
      tiers: { commons },
      parties: [party, other],
      polling: { mid: 50 },
    })

    const band = computeDifficulty(party, scenario)
    expect(band).toBeGreaterThanOrEqual(1)
    expect(band).toBeLessThanOrEqual(5)
  })
})
