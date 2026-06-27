<script setup lang="ts">
import { ref } from 'vue'
import CompassView from '@/components/CompassView.vue'
import PartyStatCard from '@/components/PartyStatCard.vue'
import LeverCard from '@/components/LeverCard.vue'
import PollingHistoryChart from '@/components/PollingHistoryChart.vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { usePartyStats } from '@/composables/usePartyStats'
import { usePartyLevers } from '@/composables/usePartyLevers'
import type { PartyFinance } from '@/types'

const game = useGameStore()
const ui = useUiStore()
const isExpanded = ref(false)

const { levers } = usePartyLevers()

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    ui.openMenu()
    game.pauseClock('menu')
  } else {
    ui.closeMenu()
    game.resumeClockIfClear()
  }
}

const {
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
} = usePartyStats()

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : value.toLocaleString('en-GB')
}

function formatPolling(value: number) {
  return `${value.toFixed(1)}%`
}

function formatScaled(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  const abs = Math.abs(value)
  const formatted =
    abs >= 1_000_000
      ? `${(value / 1_000_000).toFixed(3)}m`
      : new Intl.NumberFormat('en-GB', {
          maximumFractionDigits: 0,
        }).format(value)
  return value < 0 ? `-${formatted}` : formatted
}

function formatMoney(value: PartyFinance | undefined) {
  if (value?.estimatedCashOnHand === undefined || value?.estimatedCashOnHand === null) return '-'
  return `£${formatScaled(value.estimatedCashOnHand)}`
}
</script>

<template>
  <section
    class="hud-party absolute left-1/2 top-4 z-20 w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/85 shadow-2xl backdrop-blur-sm"
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
          <PartyStatCard label="Polling">
            <p :class="['mt-1 text-lg font-bold', pollingTrend.className]">
              {{ pollingTrend.arrow }} {{ formatPolling(currentPolling) }}
            </p>
            <template #hint>
              Momentum {{ pollingTrend.label }}
              <span class="text-zinc-500">({{ pollingDelta > 0 ? '+' : '' }}{{ pollingDelta.toFixed(1) }} pts)</span>
            </template>
          </PartyStatCard>

          <PartyStatCard label="Commons">
            <p :class="['mt-1 text-lg font-bold', commonsSeatClass]">{{ formatCount(commonsSeats) }}</p>
            <template #hint>Seats in Parliament</template>
          </PartyStatCard>

          <PartyStatCard label="Everything else">
            <p class="mt-1 text-lg font-bold text-zinc-100">{{ formatCount(otherElectedSeats) }}</p>
            <template #hint>Elected seats outside the Commons</template>
          </PartyStatCard>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <PartyStatCard label="Finance">
            <p :class="['mt-1 text-lg font-bold', financeTrend.className]">
              {{ financeTrend.arrow }} {{ formatMoney(finance) }}
            </p>
            <template #hint>
              Estimated {{ finance?.source ?? 'unknown' }}
              <span class="text-zinc-500">
                ({{ financeDelta > 0 ? '+' : '' }}{{ formatMoney({ estimatedCashOnHand: Math.abs(financeDelta), source: 'estimated' }) }})
              </span>
            </template>
          </PartyStatCard>

          <PartyStatCard label="Membership">
            <p :class="['mt-1 text-lg font-bold', membershipTrend.className]">
              {{ membershipTrend.arrow }} {{ formatCount(membership) }}
            </p>
            <template #hint>
              Declared members
              <span class="text-zinc-500">({{ membershipDelta > 0 ? '+' : '' }}{{ formatCount(Math.abs(membershipDelta)) }})</span>
            </template>
          </PartyStatCard>

          <PartyStatCard label="Councils">
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(councilsControlled) }}</p>
            <template #hint>Controlled councils</template>
          </PartyStatCard>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <PartyStatCard label="Leader approval">
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(leaderApproval) }}</p>
            <template #hint>Pending data</template>
          </PartyStatCard>

          <PartyStatCard label="Days since election">
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(daysSinceLastElection) }}</p>
            <template #hint>Most recent seat change</template>
          </PartyStatCard>

          <PartyStatCard label="Lords">
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(lordsSeats) }}</p>
            <template #hint>Appointed peers, not elected</template>
          </PartyStatCard>

          <PartyStatCard label="Mayoralties">
            <p class="mt-1 text-lg font-semibold text-zinc-100">{{ formatCount(mayoralties) }}</p>
            <template #hint>London, metro &amp; local mayors held</template>
          </PartyStatCard>
        </div>

        <PartyStatCard label="Polling history">
          <PollingHistoryChart :highlight-party-id="game.selectedPartyId" />
        </PartyStatCard>

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

        <LeverCard
          v-for="lever in levers"
          :key="lever.id"
          :label="lever.label"
          :description="lever.description"
          :forecast-summary="lever.forecastSummary"
          :cooldown-days="lever.cooldownDays"
          :allowed="lever.allowed"
          :disabled-reason="lever.disabledReason"
          :requires-confirmation="lever.requiresConfirmation"
          @activate="lever.run"
        />
      </div>
    </div>
  </section>
</template>
