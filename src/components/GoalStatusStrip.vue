<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'

const game = useGameStore()
const ui = useUiStore()

const primaryObjective = computed(() => {
  const objective = game.campaignObjectiveDefinitions.find((candidate) => candidate.kind === 'primary')
  return objective?.title ?? 'Build a Commons majority'
})

const unresolvedDecision = computed(() => {
  if (game.pendingEvents.length) return game.pendingEvents[0].headline
  const pendingContest = game.contests.find((contest) => contest.status === 'pending')
  if (pendingContest) return `Contest pending: ${pendingContest.seatName}`
  return 'No urgent decision'
})

const pauseReason = computed(() => {
  if (game.clock.running) return 'Clock running'
  if (game.pendingEvents.length) return 'Paused for a decision'
  if (ui.openMenus > 0) return 'Paused while a panel is open'
  if (game.result) return 'Paused at election result'
  return 'Paused'
})
</script>

<template>
  <section
    class="hud-goal absolute left-1/2 top-20 z-20 grid w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 gap-2 rounded-lg border border-zinc-700/70 bg-zinc-950/85 px-3 py-2 text-xs text-zinc-300 shadow-2xl backdrop-blur-sm md:grid-cols-[1.4fr_0.7fr_1.2fr_0.8fr]"
    aria-label="Campaign status"
  >
    <button type="button" class="text-left font-semibold text-zinc-100 hover:text-sky-200" @click="ui.toggleHelpPanel()">
      {{ primaryObjective }}
    </button>
    <p>{{ game.daysUntilElection }} days to GE</p>
    <p class="truncate">{{ unresolvedDecision }}</p>
    <p class="text-right text-zinc-400">{{ pauseReason }}</p>
  </section>
</template>
