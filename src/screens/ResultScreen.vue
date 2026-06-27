<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import { useUiStore } from '@/stores/ui'
import { useSaveStore } from '@/stores/save'

const game = useGameStore()
const scenario = useScenarioStore()
const ui = useUiStore()
const save = useSaveStore()

const won = computed(() => game.result === 'won')
const totalCommonsSeats = computed(() => scenario.commonsRegions.length)
const accentColour = computed(() => game.selectedParty?.colours.primary ?? '#FFFFFF')
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
const decisiveSeats = computed(() => outcome.value?.decisiveSeats.slice(0, 5) ?? [])

function partyShortName(partyId: string) {
  return scenario.party(partyId)?.shortName ?? partyId
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
  <main class="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-zinc-900 px-6 text-zinc-100">
    <p class="text-sm uppercase tracking-widest text-zinc-400">General election result</p>
    <h1 class="text-5xl font-bold" :style="{ color: accentColour }">
      {{ won ? 'You won' : 'You lost' }}
    </h1>
    <p class="max-w-3xl text-center text-lg text-zinc-300">
      {{ game.selectedParty?.shortName }} took
      <span class="font-semibold text-zinc-100">{{ playerSeats }}</span>
      of {{ totalCommonsSeats }} Commons seats
      ({{ game.winThresholdSeats }} needed for a majority, {{ seatChangeLabel }} from the starting Parliament).
    </p>

    <div
      v-if="outcome"
      class="grid w-full max-w-3xl gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm md:grid-cols-3"
    >
      <div>
        <p class="text-xs uppercase tracking-wide text-zinc-500">Model</p>
        <p class="font-medium text-zinc-200">National swing + local commitments</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide text-zinc-500">Applied</p>
        <p class="font-medium text-zinc-200">{{ outcome.appliedAt ?? outcome.date }}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide text-zinc-500">Reconciled seats</p>
        <p class="font-medium text-zinc-200">{{ outcome.winners.length }} / {{ outcome.eligibleSeatCount }}</p>
      </div>
    </div>

    <div v-if="decisiveSeats.length" class="w-full max-w-3xl text-sm">
      <p class="mb-2 text-xs uppercase tracking-wide text-zinc-500">Decisive places</p>
      <div class="grid gap-2 md:grid-cols-2">
        <p
          v-for="seat in decisiveSeats"
          :key="`${seat.regionId}:${seat.seatIndex}`"
          class="rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-zinc-300"
        >
          <span class="font-medium text-zinc-100">{{ seat.seatName }}</span>
          {{ partyShortName(seat.previousParty) }} to {{ partyShortName(seat.winnerParty) }}
        </p>
      </div>
    </div>

    <p class="max-w-2xl text-center text-sm text-zinc-500">
      {{ outcome?.provenance ?? 'Projection applied from live campaign state.' }}
    </p>

    <div class="flex gap-3">
      <button
        type="button"
        class="rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
        @click="continuePlaying"
      >
        Continue playing
      </button>
      <button
        type="button"
        class="rounded-xl border border-zinc-700 px-6 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        @click="backToMainMenu"
      >
        Main menu
      </button>
    </div>
  </main>
</template>
