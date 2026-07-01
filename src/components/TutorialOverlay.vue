<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import type { TutorialMilestoneId } from '@/types'

const game = useGameStore()

const COPY: Record<TutorialMilestoneId, { title: string; body: string }> = {
  'campaign-start': {
    title: 'Briefing live',
    body: 'The goal strip tracks your route to the next election: objective, time remaining, and any decision holding the clock.',
  },
  'first-player-lever': {
    title: 'Action logged',
    body: 'Campaign actions spend resources now or reserve capacity until they resolve. Polling effects land at the next published poll.',
  },
  'first-paused-action-event': {
    title: 'Decision on the desk',
    body: 'The clock pauses for unresolved choices. Pick a response, then the record will show the action and its effect.',
  },
  'first-contest': {
    title: 'Contest called',
    body: 'By-elections and local contests sit in the elections panel. Resolved contests leave a concise public record.',
  },
  'first-targeted-commitment': {
    title: 'Local pressure applied',
    body: 'Targeted campaigns build temporary local influence. The map records where pressure is active.',
  },
  'first-poll-release': {
    title: 'Poll published',
    body: 'Poll movement combines recorded choices, campaign action, policy fit, and bounded model variance.',
  },
  'first-election-result': {
    title: 'Election resolved',
    body: 'The result ledger separates seat projection, decisive seats, and local campaign contributions.',
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
