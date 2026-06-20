// Difficulty banding for the start-menu party picker (spec §11.1).
//
// Formula (documented, sanity-check-level for MVP — not exact figures):
//   1. "popularity proxy" = polling % (0-100) blended with weighted Commons
//      seat share (0-100, expressed as % of total seats). Seat share is
//      weighted more heavily than raw polling (0.6 vs 0.4) because holding
//      seats — and thus a realistic path to forming a government — matters
//      more for "how hard is this party to play" than current vibes alone.
//      Additional tiers (devolved/council, once they exist) can be folded in
//      via the optional `tiers` param without changing this shape: each tier
//      contributes its own seat-share %, averaged together before blending
//      with polling.
//   2. That blended score (0-100) is inverted and bucketed into five bands:
//      a dominant party (high score) lands in band 1 ("Easy"); a fringe party
//      with near-zero polling and zero seats lands in band 5 ("Extreme").
//   3. Small-party easing: bands are bucketed on a square-root curve rather
//      than linearly, which compresses the bottom end of the scale so very
//      small parties cluster into band 4 rather than uniformly maxing out at
//      5 — i.e. hard-but-not-uniformly-impossible. Band 5 is still the
//      ceiling: the result is clamped so nothing ever exceeds it.
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

/**
 * Computes a 1-5 difficulty band for playing `party` in `scenario`.
 *
 * `extraTiers` lets later phases (devolved/council data) add more seat-share
 * inputs without restructuring this function; MVP only wires Commons.
 */
export function computeDifficulty(
  party: Party,
  scenario: Scenario,
  extraTiers: DifficultyTierInput[] = [],
): DifficultyBand {
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

  const popularityProxy = pollingPct * POLLING_WEIGHT + seatShareScore * SEAT_SHARE_WEIGHT

  // Invert: higher popularity/seat-share -> lower (easier) band.
  const difficultyScore = Math.max(0, 100 - popularityProxy)

  // Small-party easing: a square-root curve compresses the high end of the
  // difficulty scale so fringe parties don't all flatline at "impossible".
  const eased = Math.sqrt(difficultyScore / 100) * 100

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
