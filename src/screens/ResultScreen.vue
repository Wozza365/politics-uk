<script setup lang="ts">
// Result screen (P1.13/P2.0, spec §11.2): win/lose evaluation at the GE date, now against the
// polling-driven seat projection (`game.projectedPlayerSeatCount`) rather than the unchanged
// starting composition. The GE is the headline moment, not a finale — there's no "game over"
// here, only a "continue playing" path back into live play (`game.continuePlaying`) alongside a
// full restart. This screen is GE-specific by design; other regular elections (devolved
// parliaments, councils, mayors) get their own non-blocking "here's what happened" notices once
// P2.1/P2.3/P2.4 land their data — see PHASE_2_PLAN.md P2.0's notes — rather than being forced
// through this win/lose shape.
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

function continuePlaying() {
  game.continuePlaying()
  ui.goToGame()
}

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
      <span class="font-semibold text-zinc-100">{{ game.projectedPlayerSeatCount }}</span>
      of {{ totalCommonsSeats }} Commons seats
      ({{ game.winThresholdSeats }} needed for a majority).
    </p>
    <p class="text-sm text-zinc-500">The country carries on — close this to keep playing.</p>
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
        @click="playAgain"
      >
        Play again
      </button>
    </div>
  </main>
</template>
