<script setup lang="ts">
// Main menu (P3.2) — replaces the MVP's one-way `StartScreen`. Surfaces Continue only when a
// compatible autosave exists for the live scenario; New game/Load game hand off to their own
// screens rather than this one owning any setup state itself.
import { computed, onMounted } from 'vue'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'
import { useScenarioStore } from '@/stores/scenario'
import { CURRENT_SAVE_FORMAT_VERSION } from '@/types'

const save = useSaveStore()
const ui = useUiStore()
const scenario = useScenarioStore()

onMounted(() => {
  save.refreshSaves()
})

const autosave = computed(() =>
  save.saves.find((entry) => entry.kind === 'autosave' && entry.scenarioId === scenario.scenario.id),
)

const continuePartyLabel = computed(() => {
  const partyId = autosave.value?.selectedPartyId
  if (!partyId) return null
  return scenario.party(partyId)?.shortName ?? partyId
})

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function continueGame() {
  if (!autosave.value) return
  ui.goToRestoring(autosave.value.id)
}
</script>

<template>
  <main class="flex h-screen w-screen flex-col items-center justify-center gap-8 bg-zinc-900 text-zinc-100">
    <h1 class="text-4xl font-bold">Politics UK</h1>

    <nav class="flex w-72 flex-col gap-3" aria-label="Main menu">
      <button
        v-if="autosave"
        type="button"
        class="rounded-md bg-zinc-100 px-4 py-3 text-left text-sm font-semibold text-zinc-900"
        @click="continueGame"
      >
        Continue
        <span class="mt-0.5 block text-xs font-normal text-zinc-600">
          {{ continuePartyLabel }} · {{ formatDate(autosave.date) }}
        </span>
      </button>

      <button
        type="button"
        class="rounded-md border border-zinc-700/70 px-4 py-3 text-sm text-zinc-100 transition-colors hover:bg-zinc-800"
        @click="ui.goToNewGame"
      >
        New game
      </button>

      <button
        type="button"
        class="rounded-md border border-zinc-700/70 px-4 py-3 text-sm text-zinc-100 transition-colors hover:bg-zinc-800"
        @click="ui.goToLoadGame"
      >
        Load game
      </button>

      <button
        type="button"
        class="cursor-not-allowed rounded-md border border-zinc-800/70 px-4 py-3 text-sm text-zinc-500"
        disabled
        aria-disabled="true"
      >
        Settings
      </button>
    </nav>

    <p class="text-xs text-zinc-500">Save format v{{ CURRENT_SAVE_FORMAT_VERSION }}</p>
  </main>
</template>
