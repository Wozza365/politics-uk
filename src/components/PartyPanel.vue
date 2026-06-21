<script setup lang="ts">
import { computed, ref } from 'vue'
import CompassView from '@/components/CompassView.vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import type { ISODate, PartyFinance, PartyHistoryEntry } from '@/types'

const game = useGameStore()
const scenario = useScenarioStore()
const isExpanded = ref(false)

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    game.pauseClock()
  } else {
    game.resumeClock()
  }
}

function daysBetween(from: ISODate, to: ISODate): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const fromMs = new Date(`${from}T00:00:00Z`).getTime()
  const toMs = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((toMs - fromMs) / msPerDay)
}

const selectedPartyId = computed(() => game.selectedPartyId)
const selectedParty = computed(() => game.selectedParty)
const previousPartyHistory = computed<PartyHistoryEntry | null>(() =>
  selectedParty.value?.history.length ? selectedParty.value.history[selectedParty.value.history.length - 1] : null,
)
const currentPolling = computed(() =>
  selectedPartyId.value ? game.polling[selectedPartyId.value] ?? 0 : 0,
)
const previousPolling = computed(() =>
  selectedPartyId.value && previousPartyHistory.value
    ? previousPartyHistory.value.polling
    : currentPolling.value,
)
const pollingDelta = computed(() => currentPolling.value - previousPolling.value)

const pollingTrend = computed(() => {
  if (pollingDelta.value > 0.05) {
    return { arrow: '↑', label: 'Up', className: 'text-emerald-300' }
  }
  if (pollingDelta.value < -0.05) {
    return { arrow: '↓', label: 'Down', className: 'text-rose-300' }
  }
  return { arrow: '→', label: 'Flat', className: 'text-zinc-100' }
})

const commonsSeats = computed(() =>
  selectedPartyId.value ? game.commonsSeatsByParty[selectedPartyId.value] ?? 0 : 0,
)
const commonsSeatClass = computed(() =>
  commonsSeats.value >= game.winThresholdSeats ? 'text-emerald-300' : 'text-rose-300',
)
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
  return lordsTier.flatMap((region) => region.seats).filter((seat) => seat.party === selectedPartyId.value)
    .length
})
const finance = computed<PartyFinance | undefined>(() =>
  selectedPartyId.value ? scenario.scenario.finances[selectedPartyId.value] : undefined,
)
const previousFinance = computed(() => previousPartyHistory.value?.finance.estimatedCashOnHand ?? null)
const financeDelta = computed(() => (finance.value?.estimatedCashOnHand ?? 0) - (previousFinance.value ?? 0))
const financeTrend = computed(() => {
  if (financeDelta.value > 0) {
    return { arrow: '↑', className: 'text-emerald-300' }
  }
  if (financeDelta.value < 0) {
    return { arrow: '↓', className: 'text-rose-300' }
  }
  return { arrow: '→', className: 'text-zinc-100' }
})
const membership = computed(() =>
  selectedPartyId.value ? scenario.scenario.membership[selectedPartyId.value] : undefined,
)
const previousMembership = computed(() => previousPartyHistory.value?.membership ?? null)
const membershipDelta = computed(() => (membership.value ?? 0) - (previousMembership.value ?? 0))
const membershipTrend = computed(() => {
  if (membershipDelta.value > 0) {
    return { arrow: '↑', className: 'text-emerald-300' }
  }
  if (membershipDelta.value < 0) {
    return { arrow: '↓', className: 'text-rose-300' }
  }
  return { arrow: '→', className: 'text-zinc-100' }
})
const councilsControlled = computed(() => {
  if (!selectedPartyId.value) return 0
  return Object.entries(scenario.scenario.tiers)
    .filter(([tierId]) => tierId.includes('council'))
    .flatMap(([, regions]) => regions)
    .flatMap((region) => region.seats)
    .filter((seat) => seat.party === selectedPartyId.value).length
})
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

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : value.toLocaleString('en-GB')
}

function formatPolling(value: number) {
  return `${value.toFixed(1)}%`
}

function formatScaled(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  const abs = Math.abs(value)
  const formatted = abs >= 1_000_000 ? `${(value / 1_000_000).toFixed(3)}m` : `${(value / 1_000).toFixed(3)}k`
  return value < 0 ? `-${formatted}` : formatted
}

function formatMoney(value: PartyFinance | undefined) {
  if (value?.estimatedCashOnHand === undefined || value?.estimatedCashOnHand === null) return '-'
  return formatScaled(value.estimatedCashOnHand)
}
</script>

<template>
  <section
    class="absolute left-1/2 top-4 z-20 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/85 shadow-2xl backdrop-blur-sm"
    :style="{
      borderColor: selectedParty?.colours.primary ?? '#52525b',
      borderWidth: '2px',
    }"
    aria-label="Party statistics"
  >
    <button
      type="button"
      class="flex w-full items-center gap-3 border-b border-zinc-800/80 px-4 py-3 text-left transition hover:bg-zinc-900/40"
      :aria-expanded="isExpanded"
      :aria-label="`${isExpanded ? 'Collapse' : 'Expand'} party statistics for ${selectedParty?.name ?? 'selected party'}`"
      @click="toggleExpanded"
    >
      <div class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-3 text-sm">
        <div class="min-w-0 whitespace-nowrap text-left text-zinc-300">
          <span :class="['font-bold', pollingTrend.className]">
            {{ pollingTrend.arrow }} {{ formatPolling(currentPolling) }}
          </span>
          <span class="px-2 text-zinc-600">|</span>
          <span :class="['font-bold', commonsSeatClass]">{{ formatCount(commonsSeats) }}</span>
          <span class="px-2 text-zinc-600">|</span>
          <span class="font-bold text-zinc-100">{{ formatCount(otherElectedSeats) }}</span>
        </div>

        <p class="truncate text-center font-semibold tracking-wide text-zinc-100">
          {{ selectedParty?.name ?? 'Party stats' }}
        </p>

        <div class="min-w-0 whitespace-nowrap text-right text-zinc-300">
          <span :class="['font-bold', membershipTrend.className]">
            {{ membershipTrend.arrow }} {{ formatCount(membership) }}
          </span>
          <span class="px-2 text-zinc-600">|</span>
          <span :class="['font-bold', financeTrend.className]">
            {{ financeTrend.arrow }} {{ formatMoney(finance) }}
          </span>
          <span class="ml-3 text-zinc-100">{{ isExpanded ? '˄' : '˅' }}</span>
        </div>
      </div>
    </button>

    <div class="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_240px]" v-if="isExpanded">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Polling</p>
            <p :class="['mt-1 text-lg font-bold', pollingTrend.className]">
              {{ pollingTrend.arrow }} {{ formatPolling(currentPolling) }}
            </p>
            <p class="mt-1 text-xs text-zinc-400">
              Momentum {{ pollingTrend.label }}
              <span class="text-zinc-500">
                ({{ pollingDelta > 0 ? '+' : '' }}{{ pollingDelta.toFixed(1) }} pts)
              </span>
            </p>
          </div>

          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Commons</p>
            <p :class="['mt-1 text-lg font-bold', commonsSeatClass]">{{ formatCount(commonsSeats) }}</p>
            <p class="mt-1 text-xs text-zinc-400">Seats in Parliament</p>
          </div>

          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Everything else</p>
            <p class="mt-1 text-lg font-bold text-zinc-100">{{ formatCount(otherElectedSeats) }}</p>
            <p class="mt-1 text-xs text-zinc-400">Elected seats outside the Commons</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Finance</p>
            <p :class="['mt-1 text-lg font-bold', financeTrend.className]">
              {{ financeTrend.arrow }} {{ formatMoney(finance) }}
            </p>
            <p class="mt-1 text-xs text-zinc-400">
              Estimated {{ finance?.source ?? 'unknown' }}
              <span class="text-zinc-500">
                ({{ financeDelta > 0 ? '+' : '' }}{{ formatMoney({ estimatedCashOnHand: Math.abs(financeDelta), source: 'estimated' }) }})
              </span>
            </p>
          </div>

          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Membership</p>
            <p :class="['mt-1 text-lg font-bold', membershipTrend.className]">
              {{ membershipTrend.arrow }} {{ formatCount(membership) }}
            </p>
            <p class="mt-1 text-xs text-zinc-400">
              Declared members
              <span class="text-zinc-500">
                ({{ membershipDelta > 0 ? '+' : '' }}{{ formatCount(Math.abs(membershipDelta)) }})
              </span>
            </p>
          </div>

          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Councils</p>
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(councilsControlled) }}</p>
            <p class="mt-1 text-xs text-zinc-400">Controlled councils</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Leader approval</p>
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(leaderApproval) }}</p>
            <p class="mt-1 text-xs text-zinc-400">Pending data</p>
          </div>

          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Days since election</p>
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(daysSinceLastElection) }}</p>
            <p class="mt-1 text-xs text-zinc-400">Most recent seat change</p>
          </div>

          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
            <p class="text-xs uppercase tracking-wide text-zinc-500">Lords</p>
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(lordsSeats) }}</p>
            <p class="mt-1 text-xs text-zinc-400">Shown separately</p>
          </div>
        </div>

        <p class="text-xs text-zinc-500">
          Estimated values are flagged; unavailable tiers remain blank until the dataset grows.
        </p>
      </div>

      <div class="flex flex-col items-center justify-start gap-3">
        <CompassView
          v-if="selectedParty?.compass"
          :items="[
            {
              position: selectedParty.compass.position,
              consistency: selectedParty.compass.consistency,
              colour: selectedParty.colours.primary,
              label: selectedParty.shortName,
            },
          ]"
          class="text-zinc-100"
        />
        <div
          v-else
          class="flex h-[240px] w-[240px] items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/60 text-sm text-zinc-500"
        >
          Compass data pending
        </div>

        <div
          v-if="isExpanded"
          class="w-full rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400"
        >
          Expanded party controls will live here later.
        </div>
      </div>
    </div>
  </section>
</template>
