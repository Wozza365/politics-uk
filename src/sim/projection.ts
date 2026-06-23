// Polling-driven seat projection at the GE (spec §11.2, PHASE_2_PLAN.md P2.0).
//
// Uniform national swing: each seat's last real result (`Seat.results`, P1.14) is the local
// baseline, and every party's vote share in that seat is shifted by the same amount its national
// polling has moved since the scenario started — the standard psephological approximation, and
// the most defensible option short of a full constituency-level polling model. A seat with no
// `results` breakdown (shouldn't happen for Commons, but kept safe for incomplete data) just keeps
// its incumbent rather than guessing.
import type { PartyId, Region } from '@/types'

/** Per-party swing in percentage points: `currentPolling - startPolling`, scenario-start to now. */
export function nationalSwing(
  startPolling: Record<PartyId, number>,
  currentPolling: Record<PartyId, number>,
): Record<PartyId, number> {
  const swing: Record<PartyId, number> = {}
  const partyIds = new Set([...Object.keys(startPolling), ...Object.keys(currentPolling)])
  for (const partyId of partyIds) {
    swing[partyId] = (currentPolling[partyId] ?? 0) - (startPolling[partyId] ?? 0)
  }
  return swing
}

/** Projects which party wins a single seat once its last result is shifted by `swing`. */
function projectSeatWinner(seat: Region['seats'][number], swing: Record<PartyId, number>): PartyId {
  if (!seat.results?.length) return seat.party
  let winner = seat.results[0]
  let winnerShare = -Infinity
  for (const candidate of seat.results) {
    const projectedShare = Math.max(0, candidate.voteShare + (swing[candidate.party] ?? 0))
    if (projectedShare > winnerShare) {
      winner = candidate
      winnerShare = projectedShare
    }
  }
  return winner.party
}

/**
 * Projects a seat count per party across `regions` (a tier's `Region[]`, e.g. Commons) under a
 * uniform national swing from `startPolling` to `currentPolling`. Pure and deterministic.
 */
export function projectSeatsByParty(
  regions: Region[],
  startPolling: Record<PartyId, number>,
  currentPolling: Record<PartyId, number>,
): Record<PartyId, number> {
  const swing = nationalSwing(startPolling, currentPolling)
  const counts: Record<PartyId, number> = {}
  for (const region of regions) {
    for (const seat of region.seats) {
      const winner = projectSeatWinner(seat, swing)
      counts[winner] = (counts[winner] ?? 0) + 1
    }
  }
  return counts
}
