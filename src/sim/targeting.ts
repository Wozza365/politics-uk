// P3.4 targeted campaigning (spec `docs/phase3/P3.4-targeting-opponents.md`). Pure and store-free,
// exactly like `sim/actions.ts` — `stores/game.ts` is the only caller, and the only place a
// `TargetScope`/`ActionOutcome` here ever turns into a state mutation (applying/reversing
// `localInfluence`, queueing polling impacts). One action template (`TARGETED_CAMPAIGN`) covers
// every scope; what differs is *where* it's aimed, not the action itself — defending a marginal
// hold and pursuing a marginal gain are the same commitment pointed at a different seat.
import type { ActionDefinition, ActionId, ActionOutcome, Contest, PartyId, Region, TargetScope, TierId, ISODate } from '@/types'
import { seededUniform } from './rng'

export const TARGETED_CAMPAIGN: ActionDefinition = {
  id: 'targetedCampaign',
  label: 'Targeted campaign',
  description: 'Commit staff and money to a specific place for two weeks, building local influence there.',
  cooldownDays: 14,
  durationDays: 14,
  cost: { money: 25_000, staff: 12 },
  recurringCost: { money: 2_000 },
  forecast: {
    pollingMagnitudeRange: [0.01, 0.03],
    summary: 'Builds bounded local influence in the chosen place over two weeks, with only a small, transparent national effect once it concludes.',
  },
}

/** Bounded local-influence a completed campaign contributes per region in its scope — deliberately
 * a fixed range, not something that scales with how big the scope is, so a 'tier' scope spreads
 * the *same* per-region strength across more places rather than ever exceeding what one seat could
 * get (spec guardrail: "never invent demographic precision the data does not support"). */
const LOCAL_INFLUENCE_BASE = 0.4
const LOCAL_INFLUENCE_VARIANCE = 0.2
/** The "defined spillover into national polling" the guardrail requires: a fraction of the local
 * influence built, never the local influence itself. */
const NATIONAL_SPILLOVER_FACTOR = 0.15
const NATIONAL_SCOPE_POLLING_BASE = 0.03
const NATIONAL_SCOPE_POLLING_VARIANCE = 0.05

/** Namespaces a target scope into the shared `ActionId` space (alongside `LeverId`/
 * `ContestActionId`) so the same scope targeted twice collides on cooldown/`alreadyCommitted`
 * checks, while two *different* scopes never do — letting a party run concurrent campaigns in
 * different places. */
export function targetActionId(scope: TargetScope): ActionId {
  const key = scope.kind === 'national' ? 'national' : scope.kind === 'tier' ? scope.tierId : scope.kind === 'seat' ? scope.regionId : scope.contestId
  return `targeting:${scope.kind}:${key ?? ''}`
}

export function isTargetingActionId(actionId: string): boolean {
  return actionId.startsWith('targeting:')
}

/** Only commons regions carry the majority/electorate stats a 'seat' target needs to show
 * competitiveness honestly (spec step 1: "add targetability metadata only where the necessary
 * identifiers and statistics exist") — devolved/council regions stay reachable only via 'tier'. */
export function isRegionTargetable(region: Region): boolean {
  return region.tier === 'commons'
}

/** Every region a scope's local influence should be applied to/read from. 'national' has none —
 * it bypasses the local-influence map entirely and resolves as a flat (small) national impact. */
export function regionIdsForScope(scope: TargetScope, tiers: Record<TierId, Region[]>, contests: Contest[]): string[] {
  switch (scope.kind) {
    case 'national':
      return []
    case 'tier':
      return scope.tierId ? (tiers[scope.tierId] ?? []).map((region) => region.id) : []
    case 'seat':
      return scope.regionId ? [scope.regionId] : []
    case 'contest': {
      const contest = contests.find((candidate) => candidate.id === scope.contestId)
      return contest ? [contest.regionId] : []
    }
  }
}

/** Deterministic per `(scope, partyId, date)` — never `Math.random()`. For a local scope, the
 * `ActionOutcome.localInfluenceMagnitude` is the commitment's real effect (applied to
 * `game.localInfluence` while the commitment is active); `pollingImpacts` only ever carries the
 * small, transparent spillover, queued for when the commitment expires like every other lever. */
export function resolveTargetingAction(scope: TargetScope, partyId: PartyId, date: ISODate): ActionOutcome {
  const actionId = targetActionId(scope)
  const roll = seededUniform(`${actionId}:${partyId}:${date}`)

  if (scope.kind === 'national') {
    const magnitude = NATIONAL_SCOPE_POLLING_BASE + roll * NATIONAL_SCOPE_POLLING_VARIANCE
    return {
      pollingImpacts: [{ partyId, magnitude, source: actionId }],
      financeDelta: 0,
      membershipDelta: 0,
      resultLabel: 'national campaign push concludes.',
    }
  }

  const localInfluenceMagnitude = LOCAL_INFLUENCE_BASE + roll * LOCAL_INFLUENCE_VARIANCE
  const nationalMagnitude = localInfluenceMagnitude * NATIONAL_SPILLOVER_FACTOR
  return {
    pollingImpacts: [{ partyId, magnitude: nationalMagnitude, source: actionId }],
    financeDelta: 0,
    membershipDelta: 0,
    resultLabel: `targeted campaign in ${scope.label} concludes.`,
    targetScope: scope,
    localInfluenceMagnitude,
  }
}

/** Net local influence for `partyId` at a region, clamped to the same bounded range a single
 * campaign can contribute — stacking two campaigns there moves it further but never past this, so
 * "stacking" can't compound into an unbounded number (spec step 3). */
export const NET_LOCAL_INFLUENCE_CAP = 1

export function clampLocalInfluence(value: number): number {
  return Math.max(-NET_LOCAL_INFLUENCE_CAP, Math.min(NET_LOCAL_INFLUENCE_CAP, value))
}

/** The threshold a region's *leading* party's net influence must clear over the second-placed
 * party's before a scheduled election treats it as a real swing factor (`consumeLocalInfluenceAtElection`
 * in `stores/game.ts`) — bounded and inspectable, not a hidden roll. */
export const LOCAL_INFLUENCE_FLIP_THRESHOLD = 0.5

/** Given one region's accumulated influence-by-party, the party (if any) whose net lead over every
 * other party clears `LOCAL_INFLUENCE_FLIP_THRESHOLD` — competing parties' campaigns in the same
 * place cancel each other out via this net-lead comparison rather than a separate "cancellation"
 * rule (spec step 3: "competing-party cancellation"). */
export function leadingPartyNetInfluence(influenceByParty: Record<PartyId, number> | undefined): PartyId | null {
  if (!influenceByParty) return null
  const entries = Object.entries(influenceByParty).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null
  const [leadingParty, leadingValue] = entries[0]
  const runnerUpValue = entries[1]?.[1] ?? 0
  if (leadingValue - runnerUpValue < LOCAL_INFLUENCE_FLIP_THRESHOLD) return null
  return leadingParty
}
