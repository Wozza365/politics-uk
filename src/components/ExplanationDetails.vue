<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useFocusTrap } from '@/composables/useFocusTrap'

const game = useGameStore()
const ui = useUiStore()
const explanation = computed(() => (ui.activeExplanationId ? game.explanationById(ui.activeExplanationId) : undefined))
const dialog = ref<HTMLElement | null>(null)
useFocusTrap(dialog, () => ui.closeExplanation(), computed(() => !!explanation.value))
</script>

<template>
  <div v-if="explanation" class="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/55 px-4" role="dialog" aria-modal="true">
    <section ref="dialog" class="max-h-[calc(100vh-4rem)] w-[min(42rem,100%)] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-5 text-sm text-zinc-200 shadow-2xl">
      <header class="flex items-start justify-between gap-4">
        <div>
          <p class="font-semibold text-zinc-100">{{ explanation.title }}</p>
          <p class="mt-1 text-xs text-zinc-400">{{ explanation.summary }}</p>
        </div>
        <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800" @click="ui.closeExplanation()">
          Close
        </button>
      </header>

      <div class="mt-4 space-y-3">
        <article v-for="group in explanation.groups" :key="group.id" class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p class="font-medium text-zinc-100">{{ group.title }}</p>
          <p class="mt-1 text-xs leading-5 text-zinc-400">{{ group.summary }}</p>
          <ul v-if="group.contributors.length" class="mt-2 space-y-1 text-xs text-zinc-300">
            <li v-for="contributor in group.contributors" :key="`${group.id}:${contributor.label}:${contributor.sourceId ?? ''}`">
              <span class="font-medium text-zinc-100">{{ contributor.label }}:</span> {{ contributor.detail }}
            </li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>
