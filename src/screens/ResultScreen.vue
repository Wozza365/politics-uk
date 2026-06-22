<script setup lang="ts">
// Result screen (P1.13, spec §11.2): minimal win/lose evaluation at the GE date. A full
// results breakdown (seat changes, coalition talk, etc.) is Phase 2 — this just surfaces the
// pass/fail condition so the loop has a visible end.
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import { useUiStore } from '@/stores/ui'

const game = useGameStore()
const scenario = useScenarioStore()
const ui = useUiStore()

const won = computed(() => game.result === 'won')
const totalCommonsSeats = computed(() => scenario.commonsRegions.length)
const accentColour = computed(() => game.selectedParty?.colours.primary ?? '#FFFFFF')

function playAgain() {
  ui.goToStart()
}
</script>

<template>
  <main class="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-zinc-900 text-zinc-100">
    <p class="text-sm uppercase tracking-widest text-zinc-400">General election result</p>
    <h1 class="text-5xl font-bold" :style="{ color: accentColour }">
      {{ won ? 'You won' : 'You lost' }}
    </h1>
    <p class="text-lg text-zinc-300">
      {{ game.selectedParty?.shortName }} took
      <span class="font-semibold text-zinc-100">{{ game.playerSeatCount }}</span>
      of {{ totalCommonsSeats }} Commons seats
      ({{ game.winThresholdSeats }} needed for a majority).
    </p>
    <button
      type="button"
      class="rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
      @click="playAgain"
    >
      Play again
    </button>
  </main>
</template>
