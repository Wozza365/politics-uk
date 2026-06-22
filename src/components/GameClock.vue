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

// Phase sawtooth 0 -> 2 over the two-day cycle, driven entirely by CSS so it pauses/resumes
// in lockstep with `animationPlayState` below (the CSS derives the fill/unfill angles from it).
const clockIconStyle = computed(() => ({
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
@property --clock-phase {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

/* 0 -> 2 sawtooth: day one is phase 0-1, day two is phase 1-2. It resets 2 -> 0 at the loop
   point, but both ends render as an empty circle (see .clock-icon below) so the jump is invisible. */
@keyframes clock-phase-cycle {
  0% {
    --clock-phase: 0;
  }
  100% {
    --clock-phase: 2;
  }
}

.clock-icon {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  /* Fill sweeps clockwise from 0deg on day one (start fixed at 0, end grows 0deg -> 360deg).
     Day two unfills the same way — clockwise from 0deg — by growing the *start* of the filled
     arc instead of shrinking its end, so the transparent wedge advances clockwise rather than
     the filled wedge receding counter-clockwise. */
  --clock-start: calc(clamp(0, var(--clock-phase) - 1, 1) * 360deg);
  --clock-end: calc(clamp(0, var(--clock-phase), 1) * 360deg);
  /* Hard conic-gradient stops render as a slightly jagged radial edge — blend each boundary
     over a couple of degrees instead so the moving edge looks anti-aliased. */
  background: conic-gradient(
    transparent 0deg,
    transparent calc(var(--clock-start) - 2deg),
    #a1a1aa calc(var(--clock-start) + 2deg),
    #a1a1aa calc(var(--clock-end) - 2deg),
    transparent calc(var(--clock-end) + 2deg),
    transparent 360deg
  );
  animation-name: clock-phase-cycle;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
</style>
