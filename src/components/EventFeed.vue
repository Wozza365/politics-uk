<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { HelpCircle } from '@lucide/vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import type { ISODate } from '@/types'

const game = useGameStore()
const ui = useUiStore()
const scrollEl = ref<HTMLElement | null>(null)

// Newest entry is appended at the bottom (spec §13 resolved: chronological == newest-at-bottom)
// — auto-scroll there as it appears.
watch(
  () => game.feed.length,
  async () => {
    await nextTick()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  },
)

function formatDate(date: ISODate) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <div ref="scrollEl" class="flex h-full flex-col gap-4 overflow-y-auto text-sm">
    <p v-if="!game.feed.length" class="text-puk-text-disabled">
      Awaiting the first tick. Events will appear here as they happen.
    </p>

    <TransitionGroup name="puk-feed" tag="div" class="contents">
      <article v-for="entry in game.feed" :key="entry.id" class="hud-record p-3">
        <p class="font-bold text-puk-text">{{ entry.headline }}</p>

        <template v-if="entry.status === 'actioned'">
          <p v-if="entry.actionTaken" class="mt-1 text-puk-text-muted">{{ entry.actionTaken }}</p>
          <p v-if="entry.effect" class="mt-0.5 text-xs text-puk-text-disabled">{{ entry.effect }}</p>
          <button
            v-if="entry.explanationId"
            type="button"
            class="hud-action-button mt-2"
            @click="ui.showExplanation(entry.explanationId)"
          >
            <HelpCircle class="h-4 w-4" aria-hidden="true" />
            Why?
          </button>
        </template>

        <div v-else class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="action in entry.actions"
            :key="action.id"
            type="button"
            class="hud-action-button hud-action-button--primary"
            @click="game.resolveFeedAction(entry.id, action.id)"
          >
            {{ action.label }}
          </button>
        </div>

        <p class="mt-2 text-xs text-puk-text-disabled">{{ formatDate(entry.date) }}</p>
      </article>
    </TransitionGroup>
  </div>
</template>
