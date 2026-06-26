import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import type { ISODate, PartyFinance, PartyHistoryEntry } from '@/types'

function daysBetween(from: ISODate, to: ISODate): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const fromMs = new Date(`${from}T00:00:00Z`).getTime()
  const toMs = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((toMs - fromMs) / msPerDay)
}

/** Derived stats for whichever party is currently selected — backs PartyPanel.vue's expanded grid. */
export function usePartyStats() {
  const game = useGameStore()
  const scenario = useScenarioStore()

  const selectedPartyId = computed(() => game.selectedPartyId)
  const selectedParty = computed(() => game.selectedParty)
  const previousPartyHistory = computed<PartyHistoryEntry | null>(() =>
    selectedParty.value?.history.length ? selectedParty.value.history[selectedParty.value.history.length - 1] : null,
  )

  const currentPolling = computed(() => (selectedPartyId.value ? game.polling[selectedPartyId.value] ?? 0 : 0))
  const previousPolling = computed(() =>
    selectedPartyId.value && previousPartyHistory.value ? previousPartyHistory.value.polling : currentPolling.value,
  )
  const pollingDelta = computed(() => currentPolling.value - previousPolling.value)
  const pollingTrend = computed(() => {
    if (pollingDelta.value > 0.05) return { arrow: '+', label: 'Up', className: 'text-emerald-300' }
    if (pollingDelta.value < -0.05) return { arrow: '-', label: 'Down', className: 'text-rose-300' }
    return { arrow: '=', label: 'Flat', className: 'text-zinc-100' }
  })

  const commonsSeats = computed(() => (selectedPartyId.value ? game.commonsSeatsByParty[selectedPartyId.value] ?? 0 : 0))
  const commonsSeatClass = computed(() => (commonsSeats.value >= game.winThresholdSeats ? 'text-emerald-300' : 'text-rose-300'))
  const otherElectedSeats = computed(() => {
    if (!selectedPartyId.value) return 0
    return Object.entries(scenario.scenario.tiers)
      .filter(([tierId]) => tierId !== 'commons' && tierId !== 'lords')
      .flatMap(([, regions]) => regions)
      .flatMap((region) => region.seats)
      .filter((seat) => seat.party === selectedPartyId.value).length
  })
  const lordsSeats = computed<number | null>(() => {
    if (!selectedPartyId.value) return null
    const lordsTier = scenario.scenario.tiers.lords
    if (!lordsTier) return null
    return lordsTier.flatMap((region) => region.seats).filter((seat) => seat.party === selectedPartyId.value).length
  })

  const finance = computed<PartyFinance | undefined>(() =>
    selectedPartyId.value ? game.finance[selectedPartyId.value] : undefined,
  )
  const previousFinance = computed(() => previousPartyHistory.value?.finance.estimatedCashOnHand ?? null)
  const financeDelta = computed(() => (finance.value?.estimatedCashOnHand ?? 0) - (previousFinance.value ?? 0))
  const financeTrend = computed(() => {
    if (financeDelta.value > 0) return { arrow: '+', className: 'text-emerald-300' }
    if (financeDelta.value < 0) return { arrow: '-', className: 'text-rose-300' }
    return { arrow: '=', className: 'text-zinc-100' }
  })

  const membership = computed(() => (selectedPartyId.value ? game.membership[selectedPartyId.value] : undefined))
  const previousMembership = computed(() => previousPartyHistory.value?.membership ?? null)
  const membershipDelta = computed(() => (membership.value ?? 0) - (previousMembership.value ?? 0))
  const membershipTrend = computed(() => {
    if (membershipDelta.value > 0) return { arrow: '+', className: 'text-emerald-300' }
    if (membershipDelta.value < 0) return { arrow: '-', className: 'text-rose-300' }
    return { arrow: '=', className: 'text-zinc-100' }
  })

  const councilsControlled = computed(() => {
    if (!selectedPartyId.value) return 0
    return scenario.councilControlCountByParty[selectedPartyId.value] ?? 0
  })
  const mayoralties = computed(() => (selectedPartyId.value ? scenario.mayoraltyCountByParty[selectedPartyId.value] ?? 0 : 0))
  const leaderApproval = computed<number | null>(() => null)
  const daysSinceLastElection = computed<number | null>(() => {
    if (!selectedPartyId.value) return null

    const dates = Object.values(scenario.scenario.tiers)
      .flatMap((regions) => regions)
      .flatMap((region) => region.seats)
      .filter((seat) => seat.party === selectedPartyId.value)
      .map((seat) => seat.electedAt)
      .filter((date): date is ISODate => Boolean(date))

    if (!dates.length) return null

    const mostRecentElection = [...dates].sort((a, b) => a.localeCompare(b))[dates.length - 1]
    return daysBetween(mostRecentElection, game.date || scenario.scenario.date)
  })

  return {
    selectedParty,
    currentPolling,
    pollingDelta,
    pollingTrend,
    commonsSeats,
    commonsSeatClass,
    otherElectedSeats,
    lordsSeats,
    finance,
    financeDelta,
    financeTrend,
    membership,
    membershipDelta,
    membershipTrend,
    councilsControlled,
    mayoralties,
    leaderApproval,
    daysSinceLastElection,
  }
}
