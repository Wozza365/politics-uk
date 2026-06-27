// Runtime by-election/minor-election scheduler (P2.8, spec §9.5). Vacancies are generated from
// scenario seats + seeded determinism rather than pre-authored as static `GameEvent`s — the
// generic event library can still carry flavour events about a by-election becoming symbolic, but
// the actual contests/results here are runtime-only. Tiers other than commons/council (devolved,
// mayoral, PCC) have no per-seat term/vacancy data in the scenario yet, so they aren't scheduled.
import type { Contest, ContestActionDef, ContestActionId, ContestTier, ISODate, PartyId, Region } from '@/types'
import type { PollingImpact } from './poll'
import { seededUniform, seededVariance } from './rng'

/** Roughly 10 parliamentary by-elections/year (low-frequency, seat-specific) vs. a few hundred
 * council by-elections/year across the much larger ward pool — tuned, not derived. */
const COMMONS_TARGET_PER_YEAR = 10
const COUNCIL_TARGET_PER_YEAR = 300
const DAYS_PER_YEAR = 365

/** Once a seat has had a by-election, it's excluded from rolling another one for this long, so
 * the same seat doesn't churn every few days. */
const COMMONS_COOLDOWN_DAYS = 365
const COUNCIL_COOLDOWN_DAYS = 120

/** Bounds how many contests one tier can generate in a single day's roll — `expected` is normally
 * far below this; it only guards against a freak Poisson tail on a long-running save. */
const MAX_COMMONS_PER_DAY = 3
const MAX_COUNCIL_PER_DAY = 40

function daysBetween(from: ISODate, to: ISODate): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const fromMs = new Date(`${from}T00:00:00Z`).getTime()
  const toMs = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((toMs - fromMs) / msPerDay)
}

/** Monday-start ISO date of the week containing `date` — the grouping key for "N council
 * by-elections called this week" feed entries. */
export function startOfIsoWeek(date: ISODate): ISODate {
  const d = new Date(`${date}T00:00:00Z`)
  const isoDayOfWeek = (d.getUTCDay() + 6) % 7 // Monday = 0 ... Sunday = 6
  d.setUTCDate(d.getUTCDate() - isoDayOfWeek)
  return d.toISOString().slice(0, 10)
}

/** Deterministic Poisson(expected) draw via inverse-CDF (Knuth) sampling, capped at `maxCount` so
 * one freak roll can't flood a single day. */
function poissonCount(expected: number, key: string, maxCount: number): number {
  if (expected <= 0) return 0
  const u = seededUniform(key)
  let cumulative = Math.exp(-expected) // P(X = 0)
  let term = cumulative
  for (let k = 0; k < maxCount; k++) {
    if (u < cumulative) return k
    term *= expected / (k + 1)
    cumulative += term
  }
  return maxCount
}

/** Deterministically picks `count` distinct regions out of `eligible`, without replacement. */
function pickRegions(eligible: Region[], count: number, date: ISODate, tier: ContestTier): Region[] {
  const remaining = [...eligible]
  const picks: Region[] = []
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const roll = seededUniform(`byelection:${tier}:pick:${date}:${i}`)
    const index = Math.min(remaining.length - 1, Math.floor(roll * remaining.length))
    picks.push(remaining[index])
    remaining.splice(index, 1)
  }
  return picks
}

function recentlyContestedRegionIds(contests: Contest[], tier: ContestTier, date: ISODate, cooldownDays: number): Set<string> {
  const ids = new Set<string>()
  for (const contest of contests) {
    if (contest.contestTier !== tier) continue
    if (daysBetween(contest.calledDate, date) < cooldownDays) ids.add(contest.regionId)
  }
  return ids
}

function buildContest(region: Region, tier: ContestTier, date: ISODate): Contest {
  const incumbentParty = region.seats[0]?.party ?? ''
  return {
    id: `byelection:${tier}:${region.id}:${date}`,
    contestTier: tier,
    regionId: region.id,
    geometryRef: region.geometryRef,
    councilGeometryRef: region.councilGeometryRef,
    councilLevel: tier === 'council' ? (region.tier.startsWith('council:county') ? 'county' : 'local') : undefined,
    seatName: tier === 'council' && region.councilName ? `${region.name}, ${region.councilName}` : region.name,
    incumbentParty,
    calledDate: date,
    status: 'pending',
  }
}

function rollTier(
  tier: ContestTier,
  pool: Region[],
  date: ISODate,
  targetPerYear: number,
  maxPerDay: number,
  cooldownDays: number,
  existingContests: Contest[],
): Contest[] {
  if (pool.length === 0) return []
  const excluded = recentlyContestedRegionIds(existingContests, tier, date, cooldownDays)
  const eligible = pool.filter((region) => !excluded.has(region.id))
  if (eligible.length === 0) return []

  const dailyRate = targetPerYear / DAYS_PER_YEAR
  const expected = dailyRate * (eligible.length / pool.length)
  const count = poissonCount(expected, `byelection:${tier}:count:${date}`, maxPerDay)
  return pickRegions(eligible, count, date, tier).map((region) => buildContest(region, tier, date))
}

/** One day's by-election roll across both generated tiers. Deterministic per
 * `(date, pool contents, existingContests)` — no `Math.random`. */
export function rollByElectionsForDay(
  date: ISODate,
  commonsSeats: Region[],
  councilWardSeats: Region[],
  existingContests: Contest[],
): Contest[] {
  return [
    ...rollTier('commons', commonsSeats, date, COMMONS_TARGET_PER_YEAR, MAX_COMMONS_PER_DAY, COMMONS_COOLDOWN_DAYS, existingContests),
    ...rollTier('council', councilWardSeats, date, COUNCIL_TARGET_PER_YEAR, MAX_COUNCIL_PER_DAY, COUNCIL_COOLDOWN_DAYS, existingContests),
  ]
}

/** Parliamentary by-elections are nationally legible and get a fuller action set; council ones
 * stay local-stakes (no "nationalise the race") — spec's "not every party should get a meaningful
 * response to every contest". */
export const CONTEST_ACTIONS_BY_TIER: Record<ContestTier, ContestActionDef[]> = {
  commons: [
    { id: 'ignore', label: 'Ignore', description: 'Let the by-election run its course without intervening.' },
    { id: 'local_push', label: 'Local push', description: 'Send activists and resource to fight for the seat directly.' },
    { id: 'nationalise', label: 'Nationalise the race', description: "Turn it into a national story to test the country's mood — high risk, high reward." },
  ],
  council: [
    { id: 'ignore', label: 'Ignore', description: 'Leave the local party to fight it alone.' },
    { id: 'token_effort', label: 'Token effort', description: 'Send a small amount of support to the local campaign.' },
    { id: 'local_push', label: 'Local push', description: 'Make a real effort to win this ward.' },
  ],
}

export interface ResolveContestResult {
  resultLabel: string
  pollingImpacts: PollingImpact[]
}

/** Resolves a player's chosen action for a contest into a polling effect + flavour result label.
 * Outcomes are deterministic per `(contest.id, actionId)` and never touch the underlying seat's
 * `party` — see the module header on why that overlay is out of scope here. */
export function resolveContestAction(contest: Contest, actionId: ContestActionId, selectedPartyId: PartyId | null): ResolveContestResult {
  const source = `byelection:${contest.id}:${actionId}`
  const incumbentHeld = `${contest.incumbentParty} hold`

  if (actionId === 'ignore' || !selectedPartyId) {
    return { resultLabel: incumbentHeld, pollingImpacts: [] }
  }

  const isIncumbent = selectedPartyId === contest.incumbentParty
  const effortMagnitude = actionId === 'token_effort' ? 0.05 : actionId === 'local_push' ? contest.contestTier === 'commons' ? 0.2 : 0.1 : 0.3 // nationalise

  if (actionId === 'nationalise') {
    // High risk, high reward: the seeded roll can swing either way, and lands on the *incumbent*
    // too (it's a national story, not just the challenger's effort).
    const swing = seededVariance(source, effortMagnitude)
    const impacts: PollingImpact[] = [{ partyId: selectedPartyId, magnitude: swing, source }]
    if (!isIncumbent) impacts.push({ partyId: contest.incumbentParty, magnitude: -swing, source })
    const resultLabel = swing >= 0 ? `${selectedPartyId} gain (national story cuts their way)` : incumbentHeld
    return { resultLabel, pollingImpacts: impacts }
  }

  const gainRoll = seededUniform(`${source}:gain`)
  const gainChance = actionId === 'local_push' ? (contest.contestTier === 'commons' ? 0.25 : 0.35) : 0.15 // token_effort
  const gained = !isIncumbent && gainRoll < gainChance

  const impacts: PollingImpact[] = [{ partyId: selectedPartyId, magnitude: effortMagnitude * (gained ? 1 : 0.4), source }]
  const resultLabel = gained ? `${selectedPartyId} gain` : isIncumbent ? incumbentHeld : `${contest.incumbentParty} hold`
  return { resultLabel, pollingImpacts: impacts }
}
