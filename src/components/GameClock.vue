<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useGameClock } from '@/composables/useGameClock'
import SaveStatusIndicator from '@/components/SaveStatusIndicator.vue'
import IconButton from '@/components/IconButton.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { Menu, Pause, Play, SkipForward, Target } from '@lucide/vue'
import type { ISODate } from '@/types'

const game = useGameStore()
const ui = useUiStore()
useGameClock()

const speedOptions = [
  { label: 'Slow', ms: 30000 },
  { label: 'Normal', ms: 15000 },
  { label: 'Fast', ms: 7500 },
] as const

const speedControlOptions = computed(() => speedOptions.map((speed) => ({ label: speed.label, value: speed.ms })))

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
      <IconButton
        :disabled="toggleDisabled"
        :label="game.clock.running ? 'Pause campaign clock' : 'Resume campaign clock'"
        @click="game.togglePlayerPause()"
      >
        <Pause v-if="game.clock.running" class="h-4 w-4" aria-hidden="true" />
        <Play v-else class="h-4 w-4" aria-hidden="true" />
      </IconButton>

      <SegmentedControl
        :options="speedControlOptions"
        :model-value="game.clock.msPerDay"
        label="Clock speed"
        @update:model-value="(value) => game.setClockSpeed(Number(value))"
      />

      <IconButton
        :disabled="!canSkipDay"
        label="Skip to next day"
        @click="game.tickDay()"
      >
        <SkipForward class="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </div>

    <div class="flex items-center justify-between gap-2">
      <SaveStatusIndicator />
      <div class="flex gap-1.5">
        <IconButton
          :aria-expanded="ui.targetingPanelOpen"
          label="Open targeted campaigning panel"
          size="sm"
          @click="toggleTargetingPanel"
        >
          <Target class="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          :aria-expanded="ui.gameMenuOpen"
          label="Open game menu"
          size="sm"
          @click="toggleGameMenu"
        >
          <Menu class="h-4 w-4" aria-hidden="true" />
        </IconButton>
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
