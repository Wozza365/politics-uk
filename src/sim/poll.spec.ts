import { describe, expect, it } from 'vitest'
import {
  applyPollingImpacts,
  computeAlignmentImpacts,
  computeVarianceImpacts,
  impactsFromRecord,
  tickPolling,
} from './poll'
import type { VoterSegment } from './segments'
import type { CompassPosition, Party, PolicyDef, PolicyStance } from '@/types'

function makeParty(id: string, overrides: Partial<Party> = {}): Party {
  return {
    id,
    name: id,
    shortName: id,
    colours: { primary: '#000000', onPrimary: '#FFFFFF' },
    scope: 'national',
    leadership: [],
    history: [],
    ...overrides,
  }
}

function stance(position: CompassPosition, consistency = 0.8): PolicyStance {
  return { position, consistency, salience: 0.5, source: 'estimated' }
}

describe('computeAlignmentImpacts — spec §10.5.2 worked examples', () => {
  it('(a) collapsing immigration salience removes a populist-right party\'s alignment advantage', () => {
    const policies: PolicyDef[] = [{ id: 'immigration', name: 'Immigration', tier: 'major' }]
    // A single segment Reform is well-placed for on immigration but `other` isn't: isolates the
    // salience effect (two offsetting segments would let a "wins one, loses the other" wash hide it).
    const segments: VoterSegment[] = [
      { id: 'right_seg', name: 'Right', position: { economic: 0.3, social: 0.8 }, weight: 100, coreBaseFor: 'reform' },
    ]
    const reform = makeParty('reform', {
      stances: { immigration: stance({ economic: 0.3, social: 0.9 }) },
      compass: { position: { economic: 0.3, social: 0.8 }, consistency: 0.8 }, // at its own base: no betrayal noise
    })
    const other = makeParty('other', { stances: { immigration: stance({ economic: -0.3, social: -0.3 }) } })
    const currentPolling = { reform: 30, other: 70 }

    const highSalience = computeAlignmentImpacts([reform, other], currentPolling, {
      policies,
      segments,
      salience: { immigration: 0.9 },
      gapToMagnitude: 1000, // avoid clamp saturation; this test compares relative gap size, not the clamp
    })
    const zeroSalience = computeAlignmentImpacts([reform, other], currentPolling, {
      policies,
      segments,
      salience: { immigration: 0 },
      gapToMagnitude: 1000,
    })

    const reformHigh = highSalience.find((i) => i.partyId === 'reform')!.magnitude
    const reformZero = zeroSalience.find((i) => i.partyId === 'reform')!.magnitude
    expect(reformHigh).toBeGreaterThan(reformZero)
  })

  it('(b) a governing party occupying green issue-space squeezes the Green party\'s segment share', () => {
    const policies: PolicyDef[] = [{ id: 'environment', name: 'Environment', tier: 'major' }]
    const salience = { environment: 0.6 }
    const segments: VoterSegment[] = [
      { id: 'green_seg', name: 'Green', position: { economic: -0.6, social: -0.6 }, weight: 50, coreBaseFor: 'green' },
      { id: 'other_seg', name: 'Other', position: { economic: 0.3, social: 0.2 }, weight: 50 },
    ]
    const green = makeParty('green', {
      stances: { environment: stance({ economic: -0.65, social: -0.6 }) },
      compass: { position: { economic: -0.6, social: -0.6 }, consistency: 0.8 },
    })
    const currentPolling = { green: 20, big: 50 }

    const bigFarFromGreen = makeParty('big', { stances: { environment: stance({ economic: 0.4, social: 0.2 }) } })
    const bigInGreenSpace = makeParty('big', { stances: { environment: stance({ economic: -0.6, social: -0.55 }) } })

    const before = computeAlignmentImpacts([green, bigFarFromGreen], currentPolling, {
      policies,
      segments,
      salience,
      gapToMagnitude: 1000,
    })
    const after = computeAlignmentImpacts([green, bigInGreenSpace], currentPolling, {
      policies,
      segments,
      salience,
      gapToMagnitude: 1000,
    })

    const greenBefore = before.find((i) => i.partyId === 'green')!.magnitude
    const greenAfter = after.find((i) => i.partyId === 'green')!.magnitude
    expect(greenAfter).toBeLessThan(greenBefore)
  })

  it('(c) the Green party adopting an anti-environment stance collapses it via the base-betrayal penalty', () => {
    const policies: PolicyDef[] = [{ id: 'environment', name: 'Environment', tier: 'major' }]
    const salience = { environment: 0.6 }
    const segments: VoterSegment[] = [
      { id: 'green_seg', name: 'Green', position: { economic: -0.6, social: -0.6 }, weight: 50, coreBaseFor: 'green' },
      { id: 'other_seg', name: 'Other', position: { economic: 0.3, social: 0.2 }, weight: 50 },
    ]
    const other = makeParty('other', { stances: { environment: stance({ economic: 0.1, social: 0.1 }) } })
    const currentPolling = { green: 20, other: 50 }

    const greenLoyal = makeParty('green', {
      stances: { environment: stance({ economic: -0.65, social: -0.6 }) },
      compass: { position: { economic: -0.6, social: -0.6 }, consistency: 0.8 },
    })
    const greenFlipped = makeParty('green', {
      stances: { environment: stance({ economic: 0.6, social: 0.6 }) },
      compass: { position: { economic: 0.6, social: 0.6 }, consistency: 0.8 },
    })

    const loyal = computeAlignmentImpacts([greenLoyal, other], currentPolling, { policies, segments, salience })
    const flipped = computeAlignmentImpacts([greenFlipped, other], currentPolling, { policies, segments, salience })

    const loyalMagnitude = loyal.find((i) => i.partyId === 'green')!.magnitude
    const flippedMagnitude = flipped.find((i) => i.partyId === 'green')!.magnitude
    expect(flippedMagnitude).toBeLessThan(loyalMagnitude)
  })

  it('gives no alignment impact to parties without any stance defined', () => {
    const noStance = makeParty('no_stance')
    const impacts = computeAlignmentImpacts([noStance], { no_stance: 10 })
    expect(impacts).toEqual([])
  })
})

describe('impactsFromRecord', () => {
  it('drops zero/undefined entries and tags every impact with the given source', () => {
    const impacts = impactsFromRecord({ labour: 0.4, conservative: 0, reform_uk: -0.2 }, 'evt-by-election')
    expect(impacts).toEqual([
      { partyId: 'labour', magnitude: 0.4, source: 'evt-by-election' },
      { partyId: 'reform_uk', magnitude: -0.2, source: 'evt-by-election' },
    ])
  })
})

describe('applyPollingImpacts', () => {
  it('is pure: identical inputs produce identical outputs', () => {
    const current = { labour: 30, conservative: 25, reform_uk: 20 }
    const impacts = [{ partyId: 'labour', magnitude: 0.5, source: 'test' }]
    expect(applyPollingImpacts(current, impacts)).toEqual(applyPollingImpacts(current, impacts))
  })

  it('preserves the field total (zero-sum redistribution)', () => {
    const current = { labour: 30, conservative: 25, reform_uk: 20 }
    const next = applyPollingImpacts(current, [
      { partyId: 'labour', magnitude: 1, source: 'test' },
      { partyId: 'conservative', magnitude: -1, source: 'test' },
    ])
    const originalTotal = Object.values(current).reduce((s, v) => s + v, 0)
    const nextTotal = Object.values(next).reduce((s, v) => s + v, 0)
    expect(nextTotal).toBeCloseTo(originalTotal, 6)
    expect(next.labour).toBeGreaterThan(current.labour)
    expect(next.conservative).toBeLessThan(current.conservative)
  })

  it('never lets a party fall to zero or below', () => {
    const current = { tiny: 0.2, big: 99.8 }
    const next = applyPollingImpacts(current, [{ partyId: 'tiny', magnitude: -1, source: 'test' }])
    expect(next.tiny).toBeGreaterThan(0)
  })
})

describe('computeVarianceImpacts', () => {
  it('is deterministic for a given date + party (no Math.random)', () => {
    const a = computeVarianceImpacts(['labour'], '2025-03-01')
    const b = computeVarianceImpacts(['labour'], '2025-03-01')
    expect(a).toEqual(b)
  })

  it('stays within the requested magnitude bound', () => {
    const impacts = computeVarianceImpacts(['labour', 'conservative', 'reform_uk'], '2025-03-01', 0.15)
    for (const impact of impacts) {
      expect(Math.abs(impact.magnitude)).toBeLessThanOrEqual(0.15)
    }
  })

  it('produces a different wobble on a different date', () => {
    const a = computeVarianceImpacts(['labour'], '2025-03-01')[0].magnitude
    const b = computeVarianceImpacts(['labour'], '2025-03-02')[0].magnitude
    expect(a).not.toBe(b)
  })
})

describe('tickPolling', () => {
  it('is deterministic given the same parties, polling, date and extra impacts', () => {
    const parties = [makeParty('labour'), makeParty('conservative')]
    const current = { labour: 30, conservative: 25 }
    const extraImpacts = [{ partyId: 'labour', magnitude: 0.3, source: 'evt-test' }]

    const a = tickPolling(current, parties, '2025-04-01', { extraImpacts })
    const b = tickPolling(current, parties, '2025-04-01', { extraImpacts })
    expect(a).toEqual(b)
  })

  it('lets external impacts (e.g. from the future event system) move a party that has no stances', () => {
    const parties = [makeParty('labour'), makeParty('conservative')]
    const current = { labour: 30, conservative: 25 }
    const next = tickPolling(current, parties, '2025-04-01', {
      extraImpacts: [{ partyId: 'labour', magnitude: 1, source: 'evt-test' }],
      varianceMagnitude: 0, // isolate the extra-impact effect from the daily wobble
    })
    expect(next.labour).toBeGreaterThan(current.labour)
  })
})
