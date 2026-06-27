import { describe, expect, it } from 'vitest'
import { advanceCommitmentsForDay, buildCommitment, canTakeAction, LEVER_ACTIONS, MAX_CONCURRENT_COMMITMENTS, resolveLeverAction } from './actions'
import type { ActionResourceState, ActiveCommitment } from '@/types'

function resources(overrides: Partial<ActionResourceState> = {}): ActionResourceState {
  return {
    money: 1_000_000,
    staffAvailable: 100,
    leadershipAvailable: 100,
    activeCommitmentCount: 0,
    cooldownRemainingDays: 0,
    alreadyCommitted: false,
    ...overrides,
  }
}

describe('canTakeAction', () => {
  it('allows an action when every resource is sufficient', () => {
    const result = canTakeAction({ cost: { money: 10_000, staff: 5, leadership: 10 } }, resources())
    expect(result).toEqual({ allowed: true })
  })

  it('denies an action still on cooldown, even if every other resource is sufficient', () => {
    const result = canTakeAction({ cost: {} }, resources({ cooldownRemainingDays: 3 }))
    expect(result).toEqual({ allowed: false, reason: 'on-cooldown' })
  })

  it('denies an action already committed to', () => {
    const result = canTakeAction({ cost: {} }, resources({ alreadyCommitted: true }))
    expect(result).toEqual({ allowed: false, reason: 'already-committed' })
  })

  it('denies a multi-day action once the party is at its concurrent-commitment cap', () => {
    const result = canTakeAction({ cost: {}, durationDays: 5 }, resources({ activeCommitmentCount: MAX_CONCURRENT_COMMITMENTS }))
    expect(result).toEqual({ allowed: false, reason: 'capacity-full' })
  })

  it('does not apply the commitment cap to instant (durationDays 0) actions', () => {
    const result = canTakeAction({ cost: {}, durationDays: 0 }, resources({ activeCommitmentCount: MAX_CONCURRENT_COMMITMENTS }))
    expect(result).toEqual({ allowed: true })
  })

  it('denies insufficient money', () => {
    const result = canTakeAction({ cost: { money: 10_000 } }, resources({ money: 9_999 }))
    expect(result).toEqual({ allowed: false, reason: 'insufficient-money' })
  })

  it('denies insufficient staff', () => {
    const result = canTakeAction({ cost: { staff: 10 } }, resources({ staffAvailable: 9 }))
    expect(result).toEqual({ allowed: false, reason: 'insufficient-staff' })
  })

  it('denies insufficient leadership', () => {
    const result = canTakeAction({ cost: { leadership: 20 } }, resources({ leadershipAvailable: 19 }))
    expect(result).toEqual({ allowed: false, reason: 'insufficient-leadership' })
  })
})

describe('resolveLeverAction determinism', () => {
  it('produces the same outcome for the same (leverId, partyId, date) every time, for every lever', () => {
    for (const leverId of Object.keys(LEVER_ACTIONS) as Array<keyof typeof LEVER_ACTIONS>) {
      const first = resolveLeverAction(leverId, 'labour', '2025-03-01')
      const second = resolveLeverAction(leverId, 'labour', '2025-03-01')
      expect(second).toEqual(first)
    }
  })

  it('produces a different roll-derived outcome for a different date', () => {
    const a = resolveLeverAction('fundraising', 'labour', '2025-03-01')
    const b = resolveLeverAction('fundraising', 'labour', '2025-03-02')
    expect(a.financeDelta).not.toBe(b.financeDelta)
  })

  it('produces a different roll-derived outcome for a different party', () => {
    const a = resolveLeverAction('fundraising', 'labour', '2025-03-01')
    const b = resolveLeverAction('fundraising', 'conservative', '2025-03-01')
    expect(a.financeDelta).not.toBe(b.financeDelta)
  })

  it('staffing is the only lever whose outcome carries a staffCapacityBonus', () => {
    const outcome = resolveLeverAction('staffing', 'labour', '2025-03-01')
    expect(outcome.staffCapacityBonus).toBeGreaterThan(0)
    const other = resolveLeverAction('policy', 'labour', '2025-03-01')
    expect(other.staffCapacityBonus).toBeUndefined()
  })
})

describe('buildCommitment', () => {
  it('shapes an ActiveCommitment from the action def, holding its upfront staff/leadership cost and ending durationDays later', () => {
    const def = LEVER_ACTIONS.campaigning
    const outcome = resolveLeverAction('campaigning', 'labour', '2025-03-01')

    const commitment = buildCommitment('campaigning', 'labour', '2025-03-01', def, outcome)

    expect(commitment.id).toBe('campaigning:labour:2025-03-01')
    expect(commitment.startedDate).toBe('2025-03-01')
    expect(commitment.endsDate).toBe('2025-03-08')
    expect(commitment.staffHeld).toBe(def.cost.staff)
    expect(commitment.leadershipHeld).toBe(def.cost.leadership ?? 0)
    expect(commitment.recurringCost).toEqual(def.recurringCost)
    expect(commitment.resultLabel).toBe(outcome.resultLabel)
    expect(commitment.financeDelta).toBe(outcome.financeDelta)
    expect(commitment.membershipDelta).toBe(outcome.membershipDelta)
  })
})

describe('advanceCommitmentsForDay', () => {
  function commitment(overrides: Partial<ActiveCommitment> = {}): ActiveCommitment {
    return {
      id: 'campaigning:labour:2025-03-01',
      actionId: 'campaigning',
      partyId: 'labour',
      startedDate: '2025-03-01',
      endsDate: '2025-03-08',
      staffHeld: 15,
      leadershipHeld: 0,
      pollingImpacts: [],
      financeDelta: 0,
      membershipDelta: 0,
      resultLabel: 'doorstep campaign push concludes.',
      ...overrides,
    }
  }

  it('keeps a commitment active while the date is before its endsDate', () => {
    const result = advanceCommitmentsForDay([commitment()], '2025-03-05')
    expect(result.stillActive).toHaveLength(1)
    expect(result.expired).toHaveLength(0)
  })

  it('expires a commitment once the date reaches its endsDate', () => {
    const result = advanceCommitmentsForDay([commitment()], '2025-03-08')
    expect(result.stillActive).toHaveLength(0)
    expect(result.expired).toHaveLength(1)
  })

  it('processes commitments in id order regardless of input order, so output is reproducible', () => {
    const a = commitment({ id: 'b-commitment', partyId: 'labour' })
    const b = commitment({ id: 'a-commitment', partyId: 'conservative' })

    const result1 = advanceCommitmentsForDay([a, b], '2025-03-05')
    const result2 = advanceCommitmentsForDay([b, a], '2025-03-05')

    expect(result1.stillActive.map((c) => c.id)).toEqual(['a-commitment', 'b-commitment'])
    expect(result2.stillActive.map((c) => c.id)).toEqual(result1.stillActive.map((c) => c.id))
  })

  it('sums recurring money costs per party across every commitment active that day, including ones expiring that same day', () => {
    const labourA = commitment({ id: 'a', partyId: 'labour', recurringCost: { money: 3_000 } })
    const labourB = commitment({ id: 'b', partyId: 'labour', recurringCost: { money: 1_000 }, endsDate: '2025-03-05' })
    const conservative = commitment({ id: 'c', partyId: 'conservative', recurringCost: { money: 500 } })

    const result = advanceCommitmentsForDay([labourA, labourB, conservative], '2025-03-05')

    expect(result.recurringMoneyCostsByParty.labour).toBe(4_000)
    expect(result.recurringMoneyCostsByParty.conservative).toBe(500)
    expect(result.expired.map((c) => c.id)).toEqual(['b'])
  })

  it('does not record a recurring cost for a commitment with no recurringCost', () => {
    const result = advanceCommitmentsForDay([commitment({ recurringCost: undefined })], '2025-03-05')
    expect(result.recurringMoneyCostsByParty).toEqual({})
  })
})
