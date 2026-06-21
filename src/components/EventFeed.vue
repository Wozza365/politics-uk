<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import type { ISODate } from '@/types'

const game = useGameStore()
const scrollEl = ref<HTMLElement | null>(null)

// Newest entry is appended at the bottom (spec §13 resolved: chronological == newest-at-bottom)
// — auto-scroll there as it appears.
watch(
  () => game.feed.length,
  async () => {
    await nextTick()
    scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
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
    <p v-if="!game.feed.length" class="text-zinc-500">
      Awaiting the first tick. Events will appear here as they happen.
    </p>

    <article v-for="entry in game.feed" :key="entry.id">
      <p class="font-bold text-zinc-100">{{ entry.headline }}</p>

      <template v-if="entry.status === 'actioned'">
        <p v-if="entry.actionTaken" class="mt-1 text-zinc-300">{{ entry.actionTaken }}</p>
        <p v-if="entry.effect" class="mt-0.5 text-xs text-zinc-500">{{ entry.effect }}</p>
      </template>

      <div v-else class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="action in entry.actions"
          :key="action.id"
          type="button"
          class="rounded-lg border border-zinc-500 px-2 py-1 text-xs text-zinc-100 transition hover:bg-zinc-100 hover:text-zinc-900"
          @click="game.resolveFeedAction(entry.id, action.id)"
        >
          {{ action.label }}
        </button>
      </div>

      <p class="mt-1 text-xs text-zinc-500">{{ formatDate(entry.date) }}</p>
    </article>
  </div>
</template>
