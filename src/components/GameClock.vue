<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useGameClock } from '@/composables/useGameClock'
import type { ISODate } from '@/types'

const game = useGameStore()
useGameClock()

// Nothing else starts the clock yet — kick it off once the game screen is up, unless an
// event is already pending (shouldn't happen this early, but keeps the rule in one place).
onMounted(() => {
  if (game.pendingEvents.length === 0) game.resumeClock()
})

function formatDate(date: ISODate) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const electionCountdownLabel = computed(() => {
  const days = game.daysUntilElection
  if (days <= 0) return 'General Election day'
  return `${days.toLocaleString('en-GB')} day${days === 1 ? '' : 's'} to GE`
})

// Triangle-wave fill: 0 -> 1 over day one, 1 -> 0 over day two, repeating — driven entirely
// by CSS so it pauses/resumes in lockstep with `animationPlayState` below.
const clockIconStyle = computed(() => ({
  '--clock-colour': game.selectedParty?.colours.primary ?? '#a1a1aa',
  animationDuration: `${game.clock.msPerDay * 2}ms`,
  animationPlayState: game.clock.running ? 'running' : 'paused',
}))
</script>

<template>
  <button
    type="button"
    disabled
    class="flex w-full items-center gap-3 px-4 py-3 text-left"
    aria-label="By-elections and other minor elections — coming soon"
  >
    <span class="clock-icon shrink-0" :style="clockIconStyle" aria-hidden="true" />
    <span class="min-w-0">
      <p class="font-semibold text-zinc-100">{{ formatDate(game.date) }}</p>
      <p class="text-zinc-400">{{ electionCountdownLabel }}</p>
    </span>
  </button>
</template>

<style>
@property --clock-fill {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@keyframes clock-fill-cycle {
  0% {
    --clock-fill: 0;
  }
  50% {
    --clock-fill: 1;
  }
  100% {
    --clock-fill: 0;
  }
}

.clock-icon {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: 1px solid rgba(161, 161, 170, 0.5);
  background: conic-gradient(
    var(--clock-colour) calc(var(--clock-fill) * 360deg),
    transparent calc(var(--clock-fill) * 360deg) 360deg
  );
  animation-name: clock-fill-cycle;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
</style>
