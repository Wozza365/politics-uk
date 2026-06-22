// The polling update function (spec §10.5.1 step 5, PHASE_1_PLAN.md P1.11.3).
//
// `PollingImpact` is the generic contract every source of polling movement is
// expressed through: the alignment model below (`computeAlignmentImpacts`),
// the seeded daily wobble (`computeVarianceImpacts`), and — later — the event
// system (P1.12) and player actions, which can hand `tickPolling` their own
// `extraImpacts` without this module needing to know about them. A magnitude
// is always on the same -1 (maximally damaging) … +1 (maximally boosting)
// scale regardless of source, so callers can mix and sum them freely.
import type { CompassPosition, ISODate, Party, PartyId, PolicyDef, PolicyId, PollingSnapshot } from '@/types'
import { POLICY_REGISTRY, TIER_WEIGHT, WORLD_SALIENCE } from './policies'
import { VOTER_SEGMENTS, type VoterSegment } from './segments'
import { seededVariance } from './rng'

export interface PollingImpact {
  partyId: PartyId
  /** -1 (maximally damaging) … +1 (maximally boosting) this party's standing. */
  magnitude: number
  /** Free-form provenance ('alignment' | 'variance' | an event id | ...) for debugging/feed text. */
  source: string
}

/** Turns "this event affects every party" into one impact per non-zero entry. */
export function impactsFromRecord(record: Partial<Record<PartyId, number>>, source: string): PollingImpact[] {
  return Object.entries(record)
    .filter(([, magnitude]) => !!magnitude)
    .map(([partyId, magnitude]) => ({ partyId, magnitude: magnitude as number, source }))
}

function distance(a: CompassPosition, b: CompassPosition): number {
  return Math.hypot(a.economic - b.economic, a.social - b.social)
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values)
  const exps = values.map((value) => Math.exp(value - max))
  const sum = exps.reduce((total, value) => total + value, 0)
  return exps.map((value) => value / sum)
}

// Distances live on a [-1,1] x [-1,1] plane, so the furthest two points apart are corners.
const MAX_COMPASS_DISTANCE = Math.hypot(2, 2)
// Lower = sharper "winner takes the segment" competition between parties.
const SOFTMAX_TEMPERATURE = 0.4
// How hard a maximally-firm, maximally-distant betrayal can shrink a party's score.
const BETRAYAL_SCALE = 1

/** A party's fit for one segment: the salience- and tier-weighted average closeness of its
 * per-policy stances to the segment's position. Higher (less negative) = better aligned. */
function segmentAlignmentScore(
  party: Party,
  segment: VoterSegment,
  policies: PolicyDef[],
  salience: Record<PolicyId, number>,
): number {
  let weightedDistance = 0
  let totalWeight = 0
  for (const policy of policies) {
    const stance = party.stances?.[policy.id]
    const policySalience = salience[policy.id] ?? 0
    if (!stance || policySalience <= 0) continue
    const weight = TIER_WEIGHT[policy.tier] * policySalience
    weightedDistance += weight * distance(stance.position, segment.position)
    totalWeight += weight
  }
  return totalWeight === 0 ? 0 : -(weightedDistance / totalWeight)
}

interface FitShareOptions {
  policies: PolicyDef[]
  salience: Record<PolicyId, number>
  segments: VoterSegment[]
}

/**
 * Each segment's voters split across parties by a softmax over closeness (so a party invading a
 * rival's issue-space takes some of its segment share, even with the rival's stance unchanged),
 * then a base-betrayal penalty (spec §10.5.1 step 5) shrinks a party's take of the field the
 * further/more firmly its overall position has drifted from its own core-identity segment.
 * Result sums to `totalMass`.
 */
function computeFitShares(parties: Party[], totalMass: number, opts: FitShareOptions): Record<PartyId, number> {
  const { policies, salience, segments } = opts
  const totalSegmentWeight = segments.reduce((sum, segment) => sum + segment.weight, 0)
  const raw: Record<PartyId, number> = {}
  for (const party of parties) raw[party.id] = 0
  if (totalSegmentWeight <= 0) return raw

  for (const segment of segments) {
    const scores = parties.map((party) => segmentAlignmentScore(party, segment, policies, salience))
    const shares = softmax(scores.map((score) => score / SOFTMAX_TEMPERATURE))
    const segmentMass = (segment.weight / totalSegmentWeight) * totalMass
    parties.forEach((party, i) => {
      raw[party.id] += shares[i] * segmentMass
    })
  }

  for (const party of parties) {
    const coreBase = segments.find((segment) => segment.coreBaseFor === party.id)
    if (!coreBase || !party.compass) continue
    const dist = distance(party.compass.position, coreBase.position)
    const penalty = Math.min(1, dist / MAX_COMPASS_DISTANCE) * party.compass.consistency * BETRAYAL_SCALE
    raw[party.id] *= 1 - penalty
  }

  const rawTotal = Object.values(raw).reduce((sum, value) => sum + value, 0)
  if (rawTotal <= 0) return raw
  const scale = totalMass / rawTotal
  for (const id of Object.keys(raw)) raw[id] *= scale
  return raw
}

export interface AlignmentOptions {
  policies?: PolicyDef[]
  salience?: Record<PolicyId, number>
  segments?: VoterSegment[]
  /** A polling-point gap of this size maps to a full ±1 magnitude impact. */
  gapToMagnitude?: number
}

/**
 * The spatial/issue-salience model (spec §10.5.1): drifts each party's polling impact toward
 * where its current stances + the world's salience say it "should" sit, relative to the field.
 * Pure and deterministic — same parties + polling in, same impacts out. Only parties with at
 * least one stance defined take part (others get no alignment impact, just variance).
 */
export function computeAlignmentImpacts(
  parties: Party[],
  currentPolling: Record<PartyId, number>,
  opts: AlignmentOptions = {},
): PollingImpact[] {
  const policies = opts.policies ?? POLICY_REGISTRY
  const salience = opts.salience ?? WORLD_SALIENCE
  const segments = opts.segments ?? VOTER_SEGMENTS
  const gapToMagnitude = opts.gapToMagnitude ?? 10

  const eligible = parties.filter((party) => party.stances && Object.keys(party.stances).length > 0)
  if (eligible.length === 0) return []

  const totalMass = eligible.reduce((sum, party) => sum + (currentPolling[party.id] ?? 0), 0)
  if (totalMass <= 0) return []

  const fitShares = computeFitShares(eligible, totalMass, { policies, salience, segments })

  return eligible.map((party) => {
    const gap = (fitShares[party.id] ?? 0) - (currentPolling[party.id] ?? 0)
    const magnitude = Math.max(-1, Math.min(1, gap / gapToMagnitude))
    return { partyId: party.id, magnitude, source: 'alignment' }
  })
}

/** Small, seeded day-to-day unpredictability (deterministic per date+party — never `Math.random`). */
export function computeVarianceImpacts(partyIds: PartyId[], date: ISODate, magnitude = 0.15): PollingImpact[] {
  return partyIds.map((partyId) => ({
    partyId,
    magnitude: seededVariance(`variance:${date}:${partyId}`, magnitude),
    source: 'variance',
  }))
}

export interface ApplyPollingImpactsOptions {
  /** Percentage points a net magnitude of ±1 moves a party by in one application. */
  maxPointsPerDay?: number
  /** Floor so a party's share never reaches zero/negative. */
  minPoint?: number
}

/**
 * Folds a batch of impacts (from any/all sources) into `currentPolling`, then renormalises so the
 * field's total stays exactly what it was (gains for one party come, proportionally, from the
 * rest of the field — vote intention is a share of a fixed pool, not free money). Pure function.
 */
export function applyPollingImpacts(
  currentPolling: Record<PartyId, number>,
  impacts: PollingImpact[],
  opts: ApplyPollingImpactsOptions = {},
): Record<PartyId, number> {
  const maxPointsPerDay = opts.maxPointsPerDay ?? 0.6
  const minPoint = opts.minPoint ?? 0.05

  const netMagnitude: Record<PartyId, number> = {}
  for (const impact of impacts) {
    netMagnitude[impact.partyId] = (netMagnitude[impact.partyId] ?? 0) + impact.magnitude
  }

  const originalTotal = Object.values(currentPolling).reduce((sum, value) => sum + value, 0)
  const next: Record<PartyId, number> = { ...currentPolling }
  for (const [partyId, magnitude] of Object.entries(netMagnitude)) {
    next[partyId] = Math.max(minPoint, (next[partyId] ?? 0) + magnitude * maxPointsPerDay)
  }
  if (originalTotal <= 0) return next

  const nextTotal = Object.values(next).reduce((sum, value) => sum + value, 0)
  if (nextTotal <= 0) return next
  const scale = originalTotal / nextTotal
  for (const partyId of Object.keys(next)) next[partyId] *= scale
  return next
}

export interface NextPollingSnapshotOptions {
  /** Impacts accumulated since the last published poll (events, action choices, callbacks). */
  extraImpacts?: PollingImpact[]
  varianceMagnitude?: number
  alignment?: AlignmentOptions
  /** How many points a net *event/action* impact magnitude of ±1 is worth in one poll release. */
  maxPointsPerRelease?: number
  /** How many points a net *background* (alignment + variance — present every release, even with
   * no events at all) magnitude of ±1 is worth — deliberately much smaller than
   * `maxPointsPerRelease`, since with nothing else happening a party's standing should barely
   * move: alignment drift is a slow structural pull, not news. */
  backgroundPointsPerRelease?: number
  /** How much of the *previous* release's point-change keeps carrying forward (momentum/trend) —
   * 0 = no memory of trend, 1 = fully repeats last time's move on top of this release's impacts. */
  momentum?: number
  /** A party's max swing in one release, as a fraction of its current standing — keeps a small
   * party's swings small in absolute terms even though they're more volatile in relative terms. */
  relativeCap?: number
  /** Absolute point floor under `relativeCap`, so a very small party isn't capped to near-zero. */
  minCap?: number
  /** Floor so a party's share never reaches zero/negative. */
  minPoint?: number
}

/**
 * One poll release's update (spec §10.5 polling cadence): unlike `tickPolling` (a per-day nudge),
 * this is called only when a "publishesPoll" event fires (`sim/events.ts`), and folds in
 * everything that's happened since the *previous* release. Event/action impacts (`extraImpacts`)
 * and ambient background drift (alignment + seeded variance) are converted to points separately —
 * background drift uses a much smaller factor, so a release with *no* events behind it barely
 * moves anyone, while a real event/action still lands with its intended weight. The result is
 * blended with the trend between the last two releases (so a move keeps some momentum rather than
 * each release starting from a blank slate), then capped relative to each party's own size so
 * headline numbers stay credible: a fringe party on ~1% can't double in one release, and a major
 * party can't swing double digits without a long run of releases pushing the same way. Rounded to
 * 1 decimal place.
 */
export function nextPollingSnapshot(
  parties: Party[],
  history: PollingSnapshot[],
  date: ISODate,
  opts: NextPollingSnapshotOptions = {},
): Record<PartyId, number> {
  const maxPointsPerRelease = opts.maxPointsPerRelease ?? 4
  const backgroundPointsPerRelease = opts.backgroundPointsPerRelease ?? 1
  const momentum = opts.momentum ?? 0.15
  const relativeCap = opts.relativeCap ?? 0.06
  const minCap = opts.minCap ?? 0.15
  const minPoint = opts.minPoint ?? 0.1

  const current = history[history.length - 1]?.polling ?? {}
  const previous = history[history.length - 2]?.polling

  const backgroundImpacts = [
    ...computeAlignmentImpacts(parties, current, opts.alignment),
    ...computeVarianceImpacts(Object.keys(current), date, opts.varianceMagnitude),
  ]
  const netBackground: Record<PartyId, number> = {}
  for (const impact of backgroundImpacts) {
    netBackground[impact.partyId] = (netBackground[impact.partyId] ?? 0) + impact.magnitude
  }
  const netExtra: Record<PartyId, number> = {}
  for (const impact of opts.extraImpacts ?? []) {
    netExtra[impact.partyId] = (netExtra[impact.partyId] ?? 0) + impact.magnitude
  }

  const originalTotal = Object.values(current).reduce((sum, value) => sum + value, 0)
  const next: Record<PartyId, number> = { ...current }
  for (const partyId of Object.keys(current)) {
    const trend = previous ? (current[partyId] ?? 0) - (previous[partyId] ?? 0) : 0
    const impactDelta =
      (netExtra[partyId] ?? 0) * maxPointsPerRelease + (netBackground[partyId] ?? 0) * backgroundPointsPerRelease
    const combinedDelta = impactDelta + momentum * trend
    const cap = Math.max(minCap, (current[partyId] ?? 0) * relativeCap)
    const cappedDelta = Math.max(-cap, Math.min(cap, combinedDelta))
    next[partyId] = Math.max(minPoint, (current[partyId] ?? 0) + cappedDelta)
  }

  if (originalTotal > 0) {
    const nextTotal = Object.values(next).reduce((sum, value) => sum + value, 0)
    if (nextTotal > 0) {
      const scale = originalTotal / nextTotal
      for (const partyId of Object.keys(next)) next[partyId] *= scale
    }
  }

  for (const partyId of Object.keys(next)) next[partyId] = Math.round(next[partyId] * 10) / 10

  return next
}

export interface TickPollingOptions {
  /** Impacts from outside this module — the event system (P1.12), player actions, etc. */
  extraImpacts?: PollingImpact[]
  varianceMagnitude?: number
  alignment?: AlignmentOptions
  apply?: ApplyPollingImpactsOptions
}

/** One day's polling update: alignment drift + seeded variance + whatever else the caller hands in. */
export function tickPolling(
  currentPolling: Record<PartyId, number>,
  parties: Party[],
  date: ISODate,
  opts: TickPollingOptions = {},
): Record<PartyId, number> {
  const impacts = [
    ...computeAlignmentImpacts(parties, currentPolling, opts.alignment),
    ...computeVarianceImpacts(Object.keys(currentPolling), date, opts.varianceMagnitude),
    ...(opts.extraImpacts ?? []),
  ]
  return applyPollingImpacts(currentPolling, impacts, opts.apply)
}
