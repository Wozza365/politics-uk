<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useGameClock } from '@/composables/useGameClock'
import SaveStatusIndicator from '@/components/SaveStatusIndicator.vue'
import type { ISODate } from '@/types'

const game = useGameStore()
const ui = useUiStore()
useGameClock()

/** Opening the panel pauses the clock through the shared `ui.openMenus` gate (P2.8) so it
 * cooperates with PartyPanel's own pause/resume rather than fighting over a single boolean. */
function toggleByElectionsPanel() {
  ui.toggleByElectionsPanel()
  if (ui.byElectionsPanelOpen) {
    ui.openMenu()
    game.pauseClock()
  } else {
    ui.closeMenu()
    game.resumeClockIfClear()
  }
}

function toggleGameMenu() {
  ui.toggleGameMenu()
  if (ui.gameMenuOpen) {
    ui.openMenu()
    game.pauseClock()
  } else {
    ui.closeMenu()
    game.resumeClockIfClear()
  }
}

function toggleTargetingPanel() {
  ui.toggleTargetingPanel()
  if (ui.targetingPanelOpen) {
    ui.openMenu()
    game.pauseClock()
  } else {
    ui.closeMenu()
    game.resumeClockIfClear()
  }
}

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
  <div class="flex w-full items-center gap-3 px-4 py-3">
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 text-left"
      :aria-expanded="ui.byElectionsPanelOpen"
      aria-label="Open by-elections and other minor elections panel"
      @click="toggleByElectionsPanel"
    >
      <span class="clock-icon shrink-0" :style="clockIconStyle" aria-hidden="true" />
      <span class="min-w-0">
        <p class="font-semibold text-zinc-100">{{ formatDate(game.date) }}</p>
        <p class="text-zinc-400">{{ electionCountdownLabel }}</p>
      </span>
    </button>
    <button
      type="button"
      class="shrink-0 rounded-full border border-zinc-700/70 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="game.pendingEvents.length > 0"
      aria-label="Skip to next day"
      @click="game.tickDay()"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
    <div class="flex shrink-0 flex-col items-end gap-1">
      <div class="flex gap-1.5">
        <button
          type="button"
          class="rounded-md border border-zinc-700/70 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          :aria-expanded="ui.targetingPanelOpen"
          aria-label="Open targeted campaigning panel"
          @click="toggleTargetingPanel"
        >
          Target
        </button>
        <button
          type="button"
          class="rounded-md border border-zinc-700/70 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          :aria-expanded="ui.gameMenuOpen"
          aria-label="Open game menu"
          @click="toggleGameMenu"
        >
          Menu
        </button>
      </div>
      <SaveStatusIndicator />
    </div>
  </div>
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
