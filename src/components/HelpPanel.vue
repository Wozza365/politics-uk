<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const entries = [
  ['Polling vs projection', 'Polling is the current vote share snapshot. Projection converts polling into Commons seats.'],
  ['National vs local impact', 'National effects move the whole field. Local influence matters in named seats and contests.'],
  ['Resource and cooldown', 'Money is spent, staff and leadership can be held, and cooldowns stop repeated use.'],
  ['Contested election', 'A pending contest can be actioned from the elections panel before it resolves.'],
  ['Scenario assumption', 'Starting data is a scenario baseline; live play records only the campaign changes made after it.'],
]
</script>

<template>
  <section
    v-if="ui.helpPanelOpen"
    class="absolute left-1/2 top-20 z-40 max-h-[calc(100vh-7rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950/95 p-4 text-sm text-zinc-200 shadow-2xl"
    aria-label="Glossary"
  >
    <header class="mb-3 flex items-center justify-between gap-3">
      <p class="font-semibold text-zinc-100">Glossary</p>
      <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800" @click="ui.closeHelpPanel()">
        Close
      </button>
    </header>
    <dl class="space-y-3">
      <div v-for="[term, definition] in entries" :key="term" class="border-t border-zinc-800 pt-3 first:border-t-0 first:pt-0">
        <dt class="font-medium text-zinc-100">{{ term }}</dt>
        <dd class="mt-1 text-xs leading-5 text-zinc-400">{{ definition }}</dd>
      </div>
    </dl>
  </section>
</template>
