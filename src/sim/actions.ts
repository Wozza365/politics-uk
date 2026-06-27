// The campaign action economy (P3.3, spec design boundary on `docs/phase3/P3.3-action-economy.md`):
// one action-definition/action-resolution system shared by P2.9's party levers and P2.8's contest
// responses. Everything here is pure and store-free — `stores/game.ts` is the only caller, and it's
// the only place a typed `ActionOutcome`/`ActiveCommitment` is ever turned into a state mutation, so
// Vue code can request an action by id but can never hand the store an arbitrary numeric delta.
import type { ActionAvailability, ActionCost, ActionDefinition, ActionId, ActionOutcome, ActionResourceState, ActiveCommitment, LeverId } from '@/types'
import type { ISODate, PartyId } from '@/types'
import { seededUniform } from './rng'

/** Every party starts with this much staff capacity before any "staffing" lever completes — tuned
 * against the lever costs below (a campaigning push + a staffing drive can run concurrently without
 * exhausting it, but a third staff-heavy commitment can't). */
export const STAFF_CAPACITY_BASE = 40
export const STAFF_CAPACITY_MAX = 100
/** Permanent capacity gained each time a "staffing" recruitment drive completes. */
export const STAFFING_DRIVE_BONUS = 10
/** Leadership attention is a fixed pool per party (not a regenerating meter) — "recovery" is
 * modelled by a leadership-costing commitment holding its share of the pool unavailable for its
 * `durationDays`, then releasing it back in full, rather than a separate passive regen rate. */
export const LEADERSHIP_ATTENTION_MAX = 100
/** A blunt cap on concurrent ongoing commitments per party — the "time/turn capacity" resource:
 * even a party with unlimited money/staff/leadership can't run an unbounded number of campaigns
 * at once. */
export const MAX_CONCURRENT_COMMITMENTS = 3

function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The audited P2.9 lever set (spec step 1): fundraising/social media are unchanged from their
 * original implementation; policy/staffing/campaigning/leadership were previously stubbed and are
 * implemented here for the first time. Staffing/campaigning/leadership are deliberately the three
 * multi-day commitments (spec step 4); fundraising/social media/policy stay instant so "routine
 * actions remain brisk" (spec step 6). */
export const LEVER_ACTIONS: Record<LeverId, ActionDefinition> = {
  fundraising: {
    id: 'fundraising',
    label: 'Fundraising appeal',
    description: 'Run an appeal to raise party finance.',
    cooldownDays: 14,
    durationDays: 0,
    cost: {},
    forecast: { summary: 'Raises an estimated £50,000-£200,000.' },
  },
  socialMedia: {
    id: 'socialMedia',
    label: 'Social media campaign',
    description: 'Run a campaign to grow membership and reach.',
    cooldownDays: 7,
    durationDays: 0,
    cost: { staff: 5 },
    forecast: {
      pollingMagnitudeRange: [0.05, 0.15],
      summary: 'Grows membership by 200-1,000 and gives a small polling lift. Needs 5 staff capacity free.',
    },
  },
  policy: {
    id: 'policy',
    label: 'Policy relaunch',
    description: 'Relaunch a flagship policy to capture the news cycle.',
    cooldownDays: 10,
    durationDays: 0,
    cost: { money: 10_000, leadership: 15 },
    forecast: { pollingMagnitudeRange: [0.05, 0.15], summary: 'A modest, immediate polling lift. Costs £10,000 and the leader’s attention.' },
  },
  staffing: {
    id: 'staffing',
    label: 'Staff recruitment drive',
    description: 'Spend five days recruiting permanent campaign staff.',
    cooldownDays: 21,
    durationDays: 5,
    cost: { money: 20_000, staff: 10 },
    forecast: { summary: 'Permanently grows staff capacity and membership once the five days are up.' },
  },
  campaigning: {
    id: 'campaigning',
    label: 'Doorstep campaign push',
    description: 'A week-long, staff-intensive ground campaign.',
    cooldownDays: 14,
    durationDays: 7,
    cost: { money: 15_000, staff: 15 },
    recurringCost: { money: 3_000 },
    forecast: {
      pollingMagnitudeRange: [0.15, 0.35],
      summary: 'A strong polling lift once the week concludes - costs a further £3,000/day while running.',
    },
  },
  leadership: {
    id: 'leadership',
    label: "Leader's national tour",
    description: 'Send the leader on a five-day national tour.',
    cooldownDays: 18,
    durationDays: 5,
    cost: { leadership: 40 },
    forecast: {
      pollingMagnitudeRange: [0.1, 0.25],
      summary: 'A solid polling lift once the tour concludes; the leader is unavailable for other leadership actions meanwhile.',
    },
  },
}

/** Validates an action against a party's current resources without spending anything — the store
 * always calls this immediately before `payActionCost`/resolving an action, and never lets a
 * component skip straight to the effect. */
export function canTakeAction(def: { cost: ActionCost; durationDays?: number }, resources: ActionResourceState): ActionAvailability {
  if (resources.cooldownRemainingDays > 0) return { allowed: false, reason: 'on-cooldown' }
  if (resources.alreadyCommitted) return { allowed: false, reason: 'already-committed' }
  if ((def.durationDays ?? 0) > 0 && resources.activeCommitmentCount >= MAX_CONCURRENT_COMMITMENTS) {
    return { allowed: false, reason: 'capacity-full' }
  }
  if ((def.cost.money ?? 0) > resources.money) return { allowed: false, reason: 'insufficient-money' }
  if ((def.cost.staff ?? 0) > resources.staffAvailable) return { allowed: false, reason: 'insufficient-staff' }
  if ((def.cost.leadership ?? 0) > resources.leadershipAvailable) return { allowed: false, reason: 'insufficient-leadership' }
  return { allowed: true }
}

/** Deterministic per `(leverId, partyId, date)` — never `Math.random()`. Amounts for fundraising/
 * social media are unchanged from the original P2.9 implementation; the result is a generic
 * `resultLabel` (no party name) so the store can prefix it with the acting party's name the same
 * way for every lever, instant or completed commitment alike. */
export function resolveLeverAction(leverId: LeverId, partyId: PartyId, date: ISODate): ActionOutcome {
  const roll = seededUniform(`lever:${leverId}:${partyId}:${date}`)
  switch (leverId) {
    case 'fundraising': {
      const raised = Math.round(50_000 + roll * 150_000)
      return { pollingImpacts: [], financeDelta: raised, membershipDelta: 0, resultLabel: `fundraising appeal raises £${raised.toLocaleString('en-GB')}.` }
    }
    case 'socialMedia': {
      const membershipGain = Math.round(200 + roll * 800)
      return {
        pollingImpacts: [{ partyId, magnitude: 0.05 + roll * 0.1, source: 'lever:socialMedia' }],
        financeDelta: 0,
        membershipDelta: membershipGain,
        resultLabel: `social media campaign reaches new supporters (+${membershipGain.toLocaleString('en-GB')} members).`,
      }
    }
    case 'policy': {
      const magnitude = 0.05 + roll * 0.1
      return { pollingImpacts: [{ partyId, magnitude, source: 'lever:policy' }], financeDelta: 0, membershipDelta: 0, resultLabel: 'policy relaunch lands with the public.' }
    }
    case 'staffing': {
      const membershipGain = Math.round(50 + roll * 200)
      return {
        pollingImpacts: [],
        financeDelta: 0,
        membershipDelta: membershipGain,
        staffCapacityBonus: STAFFING_DRIVE_BONUS,
        resultLabel: `staff recruitment drive concludes - capacity grows, +${membershipGain.toLocaleString('en-GB')} members.`,
      }
    }
    case 'campaigning': {
      const magnitude = 0.15 + roll * 0.2
      return { pollingImpacts: [{ partyId, magnitude, source: 'lever:campaigning' }], financeDelta: 0, membershipDelta: 0, resultLabel: 'doorstep campaign push concludes.' }
    }
    case 'leadership': {
      const magnitude = 0.1 + roll * 0.15
      return { pollingImpacts: [{ partyId, magnitude, source: 'lever:leadership' }], financeDelta: 0, membershipDelta: 0, resultLabel: "leader's national tour concludes." }
    }
  }
}

/** Turns a just-validated, just-resolved lever/targeting action into the `ActiveCommitment` the
 * store should push onto `activeCommitments` — never called for an instant (`durationDays === 0`)
 * action. `actionId` is widened to the full `ActionId` space (not just `LeverId`) so P3.4's
 * targeting commitments (`sim/targeting.ts`) share this exact builder rather than duplicating it. */
export function buildCommitment(actionId: ActionId, partyId: PartyId, date: ISODate, def: ActionDefinition, outcome: ActionOutcome): ActiveCommitment {
  return {
    id: `${actionId}:${partyId}:${date}`,
    actionId,
    partyId,
    startedDate: date,
    endsDate: addDays(date, def.durationDays),
    recurringCost: def.recurringCost,
    staffHeld: def.cost.staff ?? 0,
    leadershipHeld: def.cost.leadership ?? 0,
    pollingImpacts: outcome.pollingImpacts,
    financeDelta: outcome.financeDelta,
    membershipDelta: outcome.membershipDelta,
    staffCapacityBonus: outcome.staffCapacityBonus,
    resultLabel: outcome.resultLabel,
    targetScope: outcome.targetScope,
    localInfluenceMagnitude: outcome.localInfluenceMagnitude,
  }
}

export interface CommitmentAdvanceResult {
  stillActive: ActiveCommitment[]
  expired: ActiveCommitment[]
  /** Today's recurring money cost per party, summed across every commitment active today
   * (including ones that also expire today) — the store applies these against `finance`. */
  recurringMoneyCostsByParty: Record<PartyId, number>
}

/** One day's advance over every party's ongoing commitments (spec step 4: "advance/expire them on
 * the daily tick in a deterministic order"). Sorted by id (not insertion order) so two commitments
 * started the same day in different in-memory orders still expire identically. Pure — the store
 * applies `expired`'s outcomes and `recurringMoneyCostsByParty` itself. */
export function advanceCommitmentsForDay(commitments: ActiveCommitment[], date: ISODate): CommitmentAdvanceResult {
  const sorted = [...commitments].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const stillActive: ActiveCommitment[] = []
  const expired: ActiveCommitment[] = []
  const recurringMoneyCostsByParty: Record<PartyId, number> = {}

  for (const commitment of sorted) {
    if (commitment.recurringCost?.money) {
      recurringMoneyCostsByParty[commitment.partyId] = (recurringMoneyCostsByParty[commitment.partyId] ?? 0) + commitment.recurringCost.money
    }
    if (date < commitment.endsDate) stillActive.push(commitment)
    else expired.push(commitment)
  }

  return { stillActive, expired, recurringMoneyCostsByParty }
}
