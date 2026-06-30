<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import { useUiStore } from '@/stores/ui'
import { useSaveStore } from '@/stores/save'
import ExplanationDetails from '@/components/ExplanationDetails.vue'

const game = useGameStore()
const scenario = useScenarioStore()
const ui = useUiStore()
const save = useSaveStore()

const won = computed(() => game.result === 'won')
const totalCommonsSeats = computed(() => scenario.commonsRegions.length)
const accentColour = computed(() => game.selectedParty?.colours.primary ?? 'var(--puk-color-player-focus)')
const outcome = computed(() => game.latestCommonsElectionOutcome)
const playerSeats = computed(() =>
  game.selectedPartyId ? outcome.value?.countsByParty[game.selectedPartyId] ?? game.projectedPlayerSeatCount : game.projectedPlayerSeatCount,
)
const playerSeatChange = computed(() => (game.selectedPartyId ? outcome.value?.changesByParty[game.selectedPartyId] ?? 0 : 0))
const seatChangeLabel = computed(() => {
  if (playerSeatChange.value === 0) return 'no change'
  const sign = playerSeatChange.value > 0 ? '+' : ''
  return `${sign}${playerSeatChange.value}`
})
const decisiveSeats = computed(() => outcome.value?.decisiveSeats.slice(0, 6) ?? [])
const majorityMargin = computed(() => playerSeats.value - game.winThresholdSeats)
const majorityLabel = computed(() => {
  if (majorityMargin.value >= 0) return `Majority path cleared by ${majorityMargin.value + 1} seats`
  return `${Math.abs(majorityMargin.value)} seats short of a majority`
})
const seatShare = computed(() => `${Math.round((playerSeats.value / Math.max(1, totalCommonsSeats.value)) * 100)}%`)
const topRows = computed(() => {
  const rows = Object.entries(outcome.value?.countsByParty ?? {})
    .map(([partyId, seats]) => ({ partyId, seats, label: partyShortName(partyId) }))
    .sort((a, b) => b.seats - a.seats)
    .slice(0, 5)
  if (rows.length) return rows
  return game.selectedPartyId ? [{ partyId: game.selectedPartyId, seats: playerSeats.value, label: partyShortName(game.selectedPartyId) }] : []
})

function partyShortName(partyId: string) {
  return scenario.party(partyId)?.shortName ?? partyId
}

function formatDate(date: string | undefined) {
  if (!date) return 'Election night'
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function continuePlaying() {
  game.continuePlaying()
  ui.goToGame()
}

async function backToMainMenu() {
  await save.saveNow()
  ui.goToTitle()
}
</script>

<template>
  <main class="puk-screen-shell overflow-y-auto">
    <section class="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="puk-screen-kicker">General election result</p>
          <h1 class="mt-2 text-4xl font-black leading-none text-puk-text sm:text-6xl">
            {{ won ? 'Majority secured' : 'No route to Number 10' }}
          </h1>
        </div>
        <p class="text-sm font-semibold text-puk-text-muted">{{ formatDate(outcome?.appliedAt ?? outcome?.date) }}</p>
      </header>

      <section class="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]">
        <article class="puk-screen-panel overflow-hidden">
          <div class="grid min-h-[24rem] gap-0 md:grid-cols-[minmax(0,1fr)_16rem]">
            <div class="flex flex-col justify-between gap-8 p-5 sm:p-6">
              <div>
                <p class="text-sm font-semibold text-puk-text-muted">{{ game.selectedParty?.name ?? 'Your party' }}</p>
                <p class="mt-4 text-[5rem] font-black leading-none tracking-normal sm:text-[7rem]" :style="{ color: accentColour }">
                  {{ playerSeats }}
                </p>
                <p class="mt-2 text-lg font-semibold text-puk-text">
                  of {{ totalCommonsSeats }} Commons seats / {{ seatShare }}
                </p>
              </div>

              <div>
                <p class="text-xl font-bold text-puk-text">{{ majorityLabel }}</p>
                <p class="mt-2 max-w-2xl text-sm leading-6 text-puk-text-muted">
                  {{ game.selectedParty?.shortName }} finished {{ seatChangeLabel }} from the starting Parliament.
                  {{ game.winThresholdSeats }} seats were needed for a working majority.
                </p>
              </div>
            </div>

            <aside class="border-t border-puk-border-subtle bg-puk-map-backdrop/70 p-5 md:border-l md:border-t-0">
              <p class="puk-stat-label">Election board</p>
              <div class="mt-4 space-y-3">
                <div
                  v-for="row in topRows"
                  :key="row.partyId"
                  class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--puk-radius-card)] border border-puk-border-subtle bg-puk-surface/70 px-3 py-2"
                >
                  <span class="truncate text-sm font-semibold text-puk-text">{{ row.label }}</span>
                  <span class="font-mono text-sm font-bold text-puk-text">{{ row.seats }}</span>
                </div>
              </div>
            </aside>
          </div>
        </article>

        <aside class="puk-screen-panel p-5">
          <p class="puk-screen-kicker">Model note</p>
          <dl class="mt-4 grid gap-3">
            <div class="puk-stat-tile">
              <dt class="puk-stat-label">Model</dt>
              <dd class="puk-stat-value mt-2 text-sm font-semibold">National swing + local commitments</dd>
            </div>
            <div class="puk-stat-tile">
              <dt class="puk-stat-label">Applied</dt>
              <dd class="puk-stat-value mt-2 text-sm font-semibold">{{ formatDate(outcome?.appliedAt ?? outcome?.date) }}</dd>
            </div>
            <div class="puk-stat-tile">
              <dt class="puk-stat-label">Reconciled seats</dt>
              <dd class="puk-stat-value mt-2 text-sm font-semibold">
                {{ outcome?.winners.length ?? 0 }} / {{ outcome?.eligibleSeatCount ?? totalCommonsSeats }}
              </dd>
            </div>
          </dl>
          <p class="mt-4 text-sm leading-6 text-puk-text-muted">
            {{ outcome?.provenance ?? 'Projection applied from live campaign state.' }}
          </p>
          <button
            v-if="outcome?.explanationId"
            type="button"
            class="mt-5 rounded-[var(--puk-radius-control)] border border-puk-border px-4 py-2 text-sm font-semibold text-puk-text transition hover:bg-puk-surface-raised"
            @click="ui.showExplanation(outcome.explanationId)"
          >
            Open model explanation
          </button>
        </aside>
      </section>

      <section v-if="decisiveSeats.length" class="puk-screen-panel p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="puk-screen-kicker">Decisive places</p>
            <h2 class="mt-1 text-xl font-bold text-puk-text">Seats that shaped the night</h2>
          </div>
        </div>
        <div class="mt-4 grid gap-2 md:grid-cols-2">
          <p
            v-for="seat in decisiveSeats"
            :key="`${seat.regionId}:${seat.seatIndex}`"
            class="rounded-[var(--puk-radius-card)] border border-puk-border-subtle bg-puk-map-backdrop/60 px-3 py-2 text-sm text-puk-text-muted"
          >
            <span class="font-semibold text-puk-text">{{ seat.seatName }}</span>
            {{ partyShortName(seat.previousParty) }} to {{ partyShortName(seat.winnerParty) }}
          </p>
        </div>
      </section>

      <footer class="flex flex-wrap justify-end gap-3 pb-2">
        <button
          type="button"
          class="rounded-[var(--puk-radius-control)] border border-puk-player-focus/60 bg-puk-player-focus/15 px-5 py-3 text-sm font-bold text-puk-text transition hover:bg-puk-player-focus/25"
          @click="continuePlaying"
        >
          Continue playing
        </button>
        <button
          type="button"
          class="rounded-[var(--puk-radius-control)] border border-puk-border px-5 py-3 text-sm font-bold text-puk-text-muted transition hover:bg-puk-surface-raised hover:text-puk-text"
          @click="backToMainMenu"
        >
          Main menu
        </button>
      </footer>

      <ExplanationDetails />
    </section>
  </main>
</template>
