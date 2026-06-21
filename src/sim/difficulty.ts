// Difficulty banding for the start-menu party picker (spec §11.1).
//
// Formula:
//   1. "popularity proxy" = polling % (0-100) blended with weighted Commons
//      seat share (0-100, expressed as % of total seats). Seat share is
//      weighted more heavily than raw polling (0.6 vs 0.4) because holding
//      seats — and thus a realistic path to forming a government — matters
//      more for "how hard is this party to play" than current vibes alone.
//      Additional tiers (devolved/council, once they exist) can be folded in
//      via the optional `tiers` param without changing this shape: each tier
//      contributes its own seat-share %, averaged together before blending
//      with polling.
//   2. The band is **relative, not absolute**: `party`'s popularity proxy is
//      ranked against every other selectable (`scope: 'national'`) party in
//      the scenario, because "how hard is this party to play" is inherently
//      a question of standing relative to the field, not a fixed threshold —
//      e.g. a dominant governing party should land in band 1 ("Easy") even
//      if its raw polling/seat-share numbers would look unremarkable in
//      isolation. The party with the best proxy in the field is rank 0
//      (easiest); the worst is rank `field.length - 1` (hardest).
//   3. Small-party easing: rank percentile is bucketed on a square-root
//      curve rather than linearly, which compresses the bottom end of the
//      scale so very small/fringe parties cluster into band 4 ("Very Hard")
//      rather than every party below the top few uniformly maxing out at 5
//      — i.e. hard-but-not-uniformly-impossible. Band 5 ("Extreme") is
//      reserved for the bottom of the field (e.g. a party with near-zero
//      polling and zero seats).
import type { Party, Scenario } from '@/types'

export type DifficultyBand = 1 | 2 | 3 | 4 | 5

export interface DifficultyTierInput {
  /** This party's seats held in the tier. */
  seatsHeld: number
  /** Total seats available in the tier. */
  totalSeats: number
  /** Relative weight of this tier in the blended seat-share score (default 1). */
  weight?: number
}

const POLLING_WEIGHT = 0.4
const SEAT_SHARE_WEIGHT = 0.6

function popularityProxy(party: Party, scenario: Scenario, extraTiers: DifficultyTierInput[] = []): number {
  const pollingPct = scenario.polling[party.id] ?? 0

  const commonsRegions = scenario.tiers.commons ?? []
  const totalCommonsSeats = commonsRegions.length
  const commonsSeatsHeld = commonsRegions.filter((region) =>
    region.seats.some((seat) => seat.party === party.id),
  ).length

  const tiers: DifficultyTierInput[] = [
    { seatsHeld: commonsSeatsHeld, totalSeats: totalCommonsSeats, weight: 1 },
    ...extraTiers,
  ].filter((tier) => tier.totalSeats > 0)

  const seatShareScore =
    tiers.length === 0
      ? 0
      : tiers.reduce((sum, tier) => sum + (tier.seatsHeld / tier.totalSeats) * 100 * (tier.weight ?? 1), 0) /
        tiers.reduce((sum, tier) => sum + (tier.weight ?? 1), 0)

  return pollingPct * POLLING_WEIGHT + seatShareScore * SEAT_SHARE_WEIGHT
}

/**
 * Computes a 1-5 difficulty band for playing `party` in `scenario`, ranked
 * against every other selectable (`scope: 'national'`) party in the field.
 *
 * `extraTiers` lets later phases (devolved/council data) add more seat-share
 * inputs for `party` specifically, without restructuring this function; MVP
 * only wires Commons, and other parties in the field are always scored on
 * Commons alone (their devolved data isn't available to this call).
 */
export function computeDifficulty(
  party: Party,
  scenario: Scenario,
  extraTiers: DifficultyTierInput[] = [],
): DifficultyBand {
  const nationalParties = scenario.parties.filter((p) => p.scope === 'national')
  const field = nationalParties.some((p) => p.id === party.id) ? nationalParties : [...nationalParties, party]

  const ranked = field
    .map((p) => ({ id: p.id, score: p.id === party.id ? popularityProxy(p, scenario, extraTiers) : popularityProxy(p, scenario) }))
    .sort((a, b) => b.score - a.score)

  const rank = ranked.findIndex((entry) => entry.id === party.id)
  const percentile = ranked.length <= 1 ? 0 : rank / (ranked.length - 1)

  // Small-party easing: a square-root curve compresses the top (harder) end
  // of the ranking so fringe parties don't all flatline at "impossible".
  const eased = Math.sqrt(percentile) * 100

  const band = 1 + Math.floor(eased / 25)
  return Math.min(5, Math.max(1, band)) as DifficultyBand
}

export const DIFFICULTY_LABELS: Record<DifficultyBand, string> = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
  4: 'Very Hard',
  5: 'Extreme',
}
