// P3.4 opponent strategy (spec `docs/phase3/P3.4-targeting-opponents.md` step 4). Pure and
// store-free, like `sim/targeting.ts`/`sim/actions.ts` — every ranking here is a plain sort over
// real region data, with no randomness at all, so a given (party, scenario state) always produces
// the same ranked move list (spec guardrail: "deterministic and inspectable, not an LLM or hidden
// random system"). `stores/game.ts`'s `runOpponentCadence` is the only caller: it builds the
// candidate list, asks the action-economy pipeline whether the top one is affordable, and applies
// it through the exact same `runTargetingAction` the player uses.
import type { PartyId, Region, Seat, TargetScope } from '@/types'
import type { ISODate } from '@/types'

/** How often (in days since the scenario's start date) each eligible party re-evaluates its
 * targeting moves — the single cadence knob; see the module header on why aggressiveness is
 * otherwise bounded by the party's own real resources, not a separate multiplier. */
export const OPPONENT_CADENCE_DAYS = 7

/** At most one new targeting commitment per party per cadence tick — keeps a long-running save
 * from ever facing a sudden flood of simultaneous opponent campaigns. */
export const MAX_NEW_COMMITMENTS_PER_CADENCE = 1

function daysBetween(from: ISODate, to: ISODate): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const fromMs = new Date(`${from}T00:00:00Z`).getTime()
  const toMs = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((toMs - fromMs) / msPerDay)
}

export function isOpponentCadenceDay(scenarioStartDate: ISODate, date: ISODate): boolean {
  return daysBetween(scenarioStartDate, date) % OPPONENT_CADENCE_DAYS === 0
}

/** 0 = ultra-marginal (majority is a vanishingly small share of the electorate), 1 = safe. Null
 * when the seat lacks the majority/electorate data a marginality read needs — such a seat is
 * simply excluded from ranking rather than guessed at. */
export function marginalityScore(seat: Seat): number | null {
  if (seat.majority == null || !seat.electorate) return null
  return Math.min(1, seat.majority / seat.electorate)
}

export type OpponentMoveReason = 'defend' | 'pursue' | 'respond'

export interface OpponentMoveCandidate {
  scope: TargetScope
  reason: OpponentMoveReason
  score: number
  /** Recorded onto the feed entry when this move is taken (spec step 4: "record public-facing
   * summaries where the player could plausibly know about them") — the rationale itself, not just
   * the outcome. */
  rationale: string
}

const DEFEND_WEIGHT = 1
const PURSUE_WEIGHT = 0.8
/** Reacting to the player's own commitment in the same seat outranks an equally marginal seat the
 * player has shown no interest in — spec step 4's "respond to player focus". */
const RESPOND_MULTIPLIER = 1.5

/** Ranks every commons seat as a defend (held by `partyId`) or pursue (held by anyone else) move,
 * scored by how marginal it is — the more marginal, the higher the priority, since a safe seat
 * needs no defending and a hopeless target isn't a plausible gain. Seats the player already has an
 * active commitment in score higher under whichever reason already applies ("respond"). Ties break
 * on region id so the order is stable regardless of array insertion order. */
export function rankTargetingMoves(partyId: PartyId, commonsRegions: Region[], playerTargetedRegionIds: ReadonlySet<string>): OpponentMoveCandidate[] {
  const candidates: OpponentMoveCandidate[] = []

  for (const region of commonsRegions) {
    const seat = region.seats[0]
    if (!seat) continue
    const marginality = marginalityScore(seat)
    if (marginality === null) continue

    const isHeld = seat.party === partyId
    const playerIsFocused = playerTargetedRegionIds.has(region.id)
    const safety = 1 - marginality
    const reason: OpponentMoveReason = playerIsFocused ? 'respond' : isHeld ? 'defend' : 'pursue'
    let score = safety * (isHeld ? DEFEND_WEIGHT : PURSUE_WEIGHT)
    if (playerIsFocused) score *= RESPOND_MULTIPLIER

    const rationale = isHeld
      ? `${region.name} is a marginal hold (defending it).`
      : `${region.name} is a marginal seat held by ${seat.party} (a plausible gain).`

    candidates.push({
      scope: { kind: 'seat', regionId: region.id, label: region.name },
      reason,
      score,
      rationale: playerIsFocused ? `${rationale} The player is active there too.` : rationale,
    })
  }

  return candidates.sort((a, b) => b.score - a.score || (a.scope.regionId ?? '').localeCompare(b.scope.regionId ?? ''))
}

/** Walks the ranked list and returns the first move the party can actually afford right now
 * (`isAffordable` is the store's `canTakeAction` check for that candidate's scope) — "preserve
 * scarce resources" (spec step 4) falls out naturally: an unaffordable top choice is skipped
 * rather than forced through, and a party with nothing affordable simply takes no action. */
export function selectOpponentMove(candidates: OpponentMoveCandidate[], isAffordable: (scope: TargetScope) => boolean): OpponentMoveCandidate | null {
  for (const candidate of candidates) {
    if (isAffordable(candidate.scope)) return candidate
  }
  return null
}
