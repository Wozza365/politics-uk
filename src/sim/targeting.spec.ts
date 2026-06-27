import { describe, expect, it } from 'vitest'
import {
  clampLocalInfluence,
  isRegionTargetable,
  isTargetingActionId,
  LOCAL_INFLUENCE_FLIP_THRESHOLD,
  leadingPartyNetInfluence,
  NET_LOCAL_INFLUENCE_CAP,
  regionIdsForScope,
  resolveTargetingAction,
  targetActionId,
} from './targeting'
import type { Contest, Region, TargetScope, TierId } from '@/types'

function region(overrides: Partial<Region> = {}): Region {
  return {
    id: 'E14000001',
    tier: 'commons',
    name: 'Test Seat',
    geometryRef: 'E14000001',
    seats: [],
    ...overrides,
  }
}

function contest(overrides: Partial<Contest> = {}): Contest {
  return {
    id: 'contest-1',
    contestTier: 'commons',
    regionId: 'E14000002',
    geometryRef: 'E14000002',
    seatName: 'Test Seat',
    incumbentParty: 'labour',
    calledDate: '2025-03-01',
    status: 'pending',
    ...overrides,
  }
}

describe('targetActionId', () => {
  it('namespaces every scope kind under targeting:', () => {
    expect(targetActionId({ kind: 'national', label: 'National' })).toBe('targeting:national:national')
    expect(targetActionId({ kind: 'tier', tierId: 'holyrood', label: 'Holyrood' })).toBe('targeting:tier:holyrood')
    expect(targetActionId({ kind: 'seat', regionId: 'E14000001', label: 'Seat' })).toBe('targeting:seat:E14000001')
    expect(targetActionId({ kind: 'contest', contestId: 'contest-1', label: 'Contest' })).toBe('targeting:contest:contest-1')
  })

  it('produces distinct ids for two different scopes of the same kind, so cooldowns never collide', () => {
    const a = targetActionId({ kind: 'seat', regionId: 'E14000001', label: 'A' })
    const b = targetActionId({ kind: 'seat', regionId: 'E14000002', label: 'B' })
    expect(a).not.toBe(b)
  })
})

describe('isTargetingActionId', () => {
  it('recognises a targeting action id and rejects a lever/contest action id', () => {
    expect(isTargetingActionId('targeting:seat:E14000001')).toBe(true)
    expect(isTargetingActionId('campaigning')).toBe(false)
    expect(isTargetingActionId('contest:nationalise')).toBe(false)
  })
})

describe('isRegionTargetable', () => {
  it('allows commons regions and rejects every other tier', () => {
    expect(isRegionTargetable(region({ tier: 'commons' }))).toBe(true)
    expect(isRegionTargetable(region({ tier: 'holyrood' }))).toBe(false)
    expect(isRegionTargetable(region({ tier: 'council:district' }))).toBe(false)
  })
})

describe('regionIdsForScope', () => {
  const tiers: Record<TierId, Region[]> = {
    holyrood: [region({ id: 'S1', geometryRef: 'S1' }), region({ id: 'S2', geometryRef: 'S2' })],
  }
  const contests = [contest({ id: 'contest-1', regionId: 'E14000002' })]

  it('returns no regions for a national scope', () => {
    expect(regionIdsForScope({ kind: 'national', label: 'National' }, tiers, contests)).toEqual([])
  })

  it('returns every region in the named tier for a tier scope', () => {
    expect(regionIdsForScope({ kind: 'tier', tierId: 'holyrood', label: 'Holyrood' }, tiers, contests)).toEqual(['S1', 'S2'])
  })

  it('returns just the one region for a seat scope', () => {
    expect(regionIdsForScope({ kind: 'seat', regionId: 'E14000001', label: 'Seat' }, tiers, contests)).toEqual(['E14000001'])
  })

  it("returns the contest's region for a contest scope, or none if the contest id is unknown", () => {
    expect(regionIdsForScope({ kind: 'contest', contestId: 'contest-1', label: 'Contest' }, tiers, contests)).toEqual(['E14000002'])
    expect(regionIdsForScope({ kind: 'contest', contestId: 'unknown', label: 'Contest' }, tiers, contests)).toEqual([])
  })
})

describe('resolveTargetingAction determinism', () => {
  const seatScope: TargetScope = { kind: 'seat', regionId: 'E14000001', label: 'Test Seat' }

  it('produces the same outcome for the same (scope, partyId, date) every time', () => {
    const first = resolveTargetingAction(seatScope, 'labour', '2025-03-01')
    const second = resolveTargetingAction(seatScope, 'labour', '2025-03-01')
    expect(second).toEqual(first)
  })

  it('produces a different roll-derived outcome for a different date', () => {
    const a = resolveTargetingAction(seatScope, 'labour', '2025-03-01')
    const b = resolveTargetingAction(seatScope, 'labour', '2025-03-02')
    expect(a.localInfluenceMagnitude).not.toBe(b.localInfluenceMagnitude)
  })

  it('produces a different roll-derived outcome for a different party', () => {
    const a = resolveTargetingAction(seatScope, 'labour', '2025-03-01')
    const b = resolveTargetingAction(seatScope, 'conservative', '2025-03-01')
    expect(a.localInfluenceMagnitude).not.toBe(b.localInfluenceMagnitude)
  })

  it('carries the target scope and a positive local-influence magnitude for a local scope', () => {
    const outcome = resolveTargetingAction(seatScope, 'labour', '2025-03-01')
    expect(outcome.targetScope).toEqual(seatScope)
    expect(outcome.localInfluenceMagnitude).toBeGreaterThan(0)
    expect(outcome.pollingImpacts[0].magnitude).toBeGreaterThan(0)
    expect(outcome.pollingImpacts[0].magnitude).toBeLessThan(outcome.localInfluenceMagnitude!)
  })

  it('resolves a national scope as a flat polling impact with no local-influence component', () => {
    const outcome = resolveTargetingAction({ kind: 'national', label: 'National' }, 'labour', '2025-03-01')
    expect(outcome.targetScope).toBeUndefined()
    expect(outcome.localInfluenceMagnitude).toBeUndefined()
    expect(outcome.pollingImpacts[0].magnitude).toBeGreaterThan(0)
  })
})

describe('clampLocalInfluence', () => {
  it('clamps to the net-influence cap in both directions', () => {
    expect(clampLocalInfluence(NET_LOCAL_INFLUENCE_CAP + 5)).toBe(NET_LOCAL_INFLUENCE_CAP)
    expect(clampLocalInfluence(-NET_LOCAL_INFLUENCE_CAP - 5)).toBe(-NET_LOCAL_INFLUENCE_CAP)
    expect(clampLocalInfluence(0.3)).toBe(0.3)
  })
})

describe('leadingPartyNetInfluence', () => {
  it('returns null when no party has campaigned at the region', () => {
    expect(leadingPartyNetInfluence(undefined)).toBeNull()
    expect(leadingPartyNetInfluence({})).toBeNull()
  })

  it('returns null when the leading party has not cleared the flip threshold over the runner-up', () => {
    const result = leadingPartyNetInfluence({ labour: 0.5, conservative: 0.5 - (LOCAL_INFLUENCE_FLIP_THRESHOLD - 0.01) })
    expect(result).toBeNull()
  })

  it('returns the leading party once its net lead clears the flip threshold', () => {
    const result = leadingPartyNetInfluence({ labour: 0.9, conservative: 0.9 - (LOCAL_INFLUENCE_FLIP_THRESHOLD + 0.01) })
    expect(result).toBe('labour')
  })

  it('treats a lone campaigning party against an implicit zero runner-up', () => {
    expect(leadingPartyNetInfluence({ labour: LOCAL_INFLUENCE_FLIP_THRESHOLD + 0.01 })).toBe('labour')
    expect(leadingPartyNetInfluence({ labour: LOCAL_INFLUENCE_FLIP_THRESHOLD - 0.01 })).toBeNull()
  })
})
