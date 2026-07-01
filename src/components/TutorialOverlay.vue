<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import type { TutorialMilestoneId } from '@/types'

const game = useGameStore()

const COPY: Record<TutorialMilestoneId, { title: string; body: string }> = {
  'campaign-start': {
    title: 'Start from the objective',
    body: 'Your live objective, next election timing, unresolved decision, and pause reason are shown across the top of the campaign.',
  },
  'first-player-lever': {
    title: 'Campaign action recorded',
    body: 'Actions spend resources now or reserve staff until they resolve. Their polling effect appears at the next published poll.',
  },
  'first-paused-action-event': {
    title: 'Decision needed',
    body: 'The clock pauses when an event needs a choice. Save and menu controls remain available while you decide.',
  },
  'first-contest': {
    title: 'Contest called',
    body: 'By-elections and local contests sit in the elections panel. Resolved contests record a short cause summary.',
  },
  'first-targeted-commitment': {
    title: 'Local campaign committed',
    body: 'Targeted commitments build temporary local influence, visible on the map and considered by contests and elections.',
  },
  'first-poll-release': {
    title: 'Poll released',
    body: 'Poll movements combine recorded events, campaign actions, policy alignment, and bounded variance.',
  },
  'first-election-result': {
    title: 'Election resolved',
    body: 'The result ledger shows the model, decisive seats, and local-commitment contributions.',
  },
}

const active = computed(() => game.activeTutorialMilestone)
const copy = computed(() => (active.value ? COPY[active.value] : null))

function dismiss() {
  if (active.value) game.dismissTutorialMilestone(active.value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') dismiss()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition name="puk-popover">
    <aside
      v-if="active && copy"
      class="hud-tutorial hud-record absolute bottom-40 left-[22rem] z-40 w-[min(24rem,calc(100vw-24rem))] p-4 text-sm"
      aria-live="polite"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-semibold text-puk-text">{{ copy.title }}</p>
          <p class="mt-1 text-xs leading-5 text-puk-text-muted">{{ copy.body }}</p>
        </div>
        <button type="button" class="hud-action-button shrink-0" @click="dismiss">
          Skip
        </button>
      </div>
    </aside>
  </Transition>
</template>
