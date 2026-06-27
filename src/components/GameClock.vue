<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useGameClock } from '@/composables/useGameClock'
import SaveStatusIndicator from '@/components/SaveStatusIndicator.vue'
import type { ISODate } from '@/types'

const game = useGameStore()
const ui = useUiStore()
useGameClock()

const speedOptions = [
  { label: 'Slow', ms: 30000 },
  { label: 'Normal', ms: 15000 },
  { label: 'Fast', ms: 7500 },
] as const

function toggleByElectionsPanel() {
  ui.toggleByElectionsPanel()
  if (ui.byElectionsPanelOpen) {
    ui.openMenu()
    game.pauseClock('menu')
  } else {
    ui.closeMenu()
    game.resumeClockIfClear()
  }
}

function toggleGameMenu() {
  ui.toggleGameMenu()
  if (ui.gameMenuOpen) {
    ui.openMenu()
    game.pauseClock('menu')
  } else {
    ui.closeMenu()
    game.resumeClockIfClear()
  }
}

function toggleTargetingPanel() {
  ui.toggleTargetingPanel()
  if (ui.targetingPanelOpen) {
    ui.openMenu()
    game.pauseClock('menu')
  } else {
    ui.closeMenu()
    game.resumeClockIfClear()
  }
}

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

const clockIconStyle = computed(() => ({
  animationDuration: `${game.clock.msPerDay * 2}ms`,
  animationPlayState: game.clock.running ? 'running' : 'paused',
}))

const canSkipDay = computed(() => game.clock.pauseReasons.pendingAction === 0 && game.clock.pauseReasons.electionResult === 0)
const toggleDisabled = computed(
  () =>
    !game.clock.running &&
    game.clock.pauseReasons.player === 0 &&
    game.clock.pauseReasons.restoring === 0 &&
    (game.clock.pauseReasons.pendingAction > 0 || game.clock.pauseReasons.electionResult > 0),
)
</script>

<template>
  <div class="flex w-full flex-col gap-3 px-4 py-3">
    <button
      type="button"
      class="flex min-w-0 items-center gap-3 text-left"
      :aria-expanded="ui.byElectionsPanelOpen"
      aria-label="Open by-elections and other minor elections panel"
      @click="toggleByElectionsPanel"
    >
      <span class="clock-icon shrink-0" :style="clockIconStyle" aria-hidden="true" />
      <span class="min-w-0">
        <p class="font-semibold text-zinc-100">{{ formatDate(game.date) }}</p>
        <p class="text-zinc-400">{{ electionCountdownLabel }}</p>
        <p class="text-xs font-semibold text-sky-200" aria-live="polite">{{ game.clockStatusLabel }}</p>
      </span>
    </button>

    <div class="grid grid-cols-[auto_1fr_auto] items-center gap-2">
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700/70 text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
        :disabled="toggleDisabled"
        :aria-label="game.clock.running ? 'Pause campaign clock' : 'Resume campaign clock'"
        @click="game.togglePlayerPause()"
      >
        <svg v-if="game.clock.running" viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <div class="grid grid-cols-3 gap-1 rounded-md border border-zinc-700/70 p-1" role="radiogroup" aria-label="Clock speed">
        <button
          v-for="speed in speedOptions"
          :key="speed.ms"
          type="button"
          role="radio"
          class="rounded px-2 py-1 text-xs font-semibold transition-colors"
          :class="game.clock.msPerDay === speed.ms ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'"
          :aria-checked="game.clock.msPerDay === speed.ms"
          @click="game.setClockSpeed(speed.ms)"
        >
          {{ speed.label }}
        </button>
      </div>

      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700/70 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canSkipDay"
        aria-label="Skip to next day"
        @click="game.tickDay()"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>

    <div class="flex items-center justify-between gap-2">
      <SaveStatusIndicator />
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
    </div>
  </div>
</template>

<style>
@property --clock-phase {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

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
  --clock-start: calc(clamp(0, var(--clock-phase) - 1, 1) * 360deg);
  --clock-end: calc(clamp(0, var(--clock-phase), 1) * 360deg);
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

@media (prefers-reduced-motion: reduce) {
  .clock-icon {
    animation: none !important;
  }
}
</style>
