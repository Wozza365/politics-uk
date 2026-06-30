<script setup lang="ts">
import { computed } from 'vue'
import { HelpCircle } from '@lucide/vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import HudPanel from '@/components/HudPanel.vue'
import IconButton from '@/components/IconButton.vue'

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
  <HudPanel
    class="hud-goal absolute right-4 top-56 z-20 grid w-80 max-w-[calc(100vw-2rem)] gap-2 px-3 py-2 text-xs text-puk-text-muted"
    aria-label="Campaign status"
  >
    <div class="flex items-start justify-between gap-2">
      <p class="font-semibold text-puk-text">{{ primaryObjective }}</p>
      <IconButton label="Open glossary" size="sm" tone="ghost" @click="ui.toggleHelpPanel()">
        <HelpCircle class="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </div>
    <p>{{ game.daysUntilElection }} days to GE</p>
    <p class="truncate">{{ unresolvedDecision }}</p>
    <p class="text-puk-text-disabled">{{ pauseReason }}</p>
  </HudPanel>
</template>
