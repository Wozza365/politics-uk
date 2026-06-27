import type { ElectionOutcome, ElectionSeatWinner, ISODate, PartyId, Region } from '@/types'
import { leadingPartyNetInfluence } from '@/sim/targeting'
import { nationalSwing } from '@/sim/projection'

export interface ResolveCommonsElectionInput {
  date: ISODate
  regions: Region[]
  startPolling: Record<PartyId, number>
  currentPolling: Record<PartyId, number>
  localInfluenceByRegion?: Record<string, Record<PartyId, number>>
  selectedPartyId?: PartyId | null
  majorityThreshold: number
}

function countStartingSeats(regions: Region[]): Record<PartyId, number> {
  const counts: Record<PartyId, number> = {}
  for (const region of regions) {
    for (const seat of region.seats) {
      counts[seat.party] = (counts[seat.party] ?? 0) + 1
    }
  }
  return counts
}

function seatWinner(
  region: Region,
  seat: Region['seats'][number],
  seatIndex: number,
  swing: Record<PartyId, number>,
  localInfluenceByRegion: Record<string, Record<PartyId, number>>,
): ElectionSeatWinner {
  const influenceWinner = leadingPartyNetInfluence(localInfluenceByRegion[region.id])
  const seatName = seat.wardName ?? region.name
  if (influenceWinner) {
    return {
      regionId: region.id,
      geometryRef: region.geometryRef,
      seatIndex,
      seatName,
      previousParty: seat.party,
      winnerParty: influenceWinner,
      source: 'local-commitment',
    }
  }

  if (!seat.results?.length) {
    return {
      regionId: region.id,
      geometryRef: region.geometryRef,
      seatIndex,
      seatName,
      previousParty: seat.party,
      winnerParty: seat.party,
      source: 'incumbent-fallback',
    }
  }

  const projected = seat.results
    .map((candidate) => ({
      party: candidate.party,
      share: Math.max(0, candidate.voteShare + (swing[candidate.party] ?? 0)),
    }))
    .sort((a, b) => b.share - a.share)
  const winner = projected[0]
  const runnerUp = projected[1]

  return {
    regionId: region.id,
    geometryRef: region.geometryRef,
    seatIndex,
    seatName,
    previousParty: seat.party,
    winnerParty: winner.party,
    source: 'national-swing',
    projectedShare: winner.share,
    runnerUpParty: runnerUp?.party,
    runnerUpProjectedShare: runnerUp?.share,
  }
}

export function resolveCommonsElection(input: ResolveCommonsElectionInput): ElectionOutcome {
  const swing = nationalSwing(input.startPolling, input.currentPolling)
  const winners: ElectionSeatWinner[] = []
  for (const region of input.regions) {
    for (const [seatIndex, seat] of region.seats.entries()) {
      winners.push(seatWinner(region, seat, seatIndex, swing, input.localInfluenceByRegion ?? {}))
    }
  }

  const countsByParty: Record<PartyId, number> = {}
  for (const winner of winners) {
    countsByParty[winner.winnerParty] = (countsByParty[winner.winnerParty] ?? 0) + 1
  }

  const startingCounts = countStartingSeats(input.regions)
  const changesByParty: Record<PartyId, number> = {}
  for (const partyId of new Set([...Object.keys(startingCounts), ...Object.keys(countsByParty)])) {
    const change = (countsByParty[partyId] ?? 0) - (startingCounts[partyId] ?? 0)
    if (change !== 0) changesByParty[partyId] = change
  }

  const decisiveSeats = winners
    .filter((winner) => winner.previousParty !== winner.winnerParty)
    .sort((a, b) => {
      const aMargin = (a.projectedShare ?? Infinity) - (a.runnerUpProjectedShare ?? 0)
      const bMargin = (b.projectedShare ?? Infinity) - (b.runnerUpProjectedShare ?? 0)
      return aMargin - bMargin || a.seatName.localeCompare(b.seatName)
    })
    .slice(0, 8)

  const selectedSeats = input.selectedPartyId ? countsByParty[input.selectedPartyId] ?? 0 : 0
  const playerObjective = input.selectedPartyId ? (selectedSeats >= input.majorityThreshold ? 'won' : 'lost') : undefined

  return {
    id: `election:commons:${input.date}`,
    instanceId: `instance:commons:${input.date}`,
    tier: 'commons',
    date: input.date,
    status: 'pending',
    model: 'uniform-national-swing-local-commitments',
    provenance: 'Commons resolver: baseline constituency results, live national polling swing, and active local commitments.',
    eligibleSeatCount: winners.length,
    winners,
    countsByParty,
    changesByParty,
    decisiveSeats,
    playerObjective,
    summary: `Resolved ${winners.length} Commons seats from live polling and local campaign commitments.`,
  }
}
