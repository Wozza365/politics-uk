<script setup lang="ts">
// Load-game browser (P3.2 step 2/5): lists every save — the rolling autosave and manual slots
// alike — newest first, and hands off to `RestoreScreen` to do the actual read/hydrate. Renaming/
// deleting/exporting a manual slot stays the in-game Saves panel's job (`SaveManagementPanel.vue`)
// — this screen's only job is picking one to load.
import { computed, onMounted } from 'vue'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'
import { useScenarioStore } from '@/stores/scenario'

const save = useSaveStore()
const ui = useUiStore()
const scenario = useScenarioStore()

onMounted(() => {
  save.refreshSaves()
})

const saves = computed(() =>
  [...save.saves]
    .filter((entry) => entry.scenarioId === scenario.scenario.id)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
)

function partyLabel(partyId: string | null) {
  if (!partyId) return '—'
  return scenario.party(partyId)?.shortName ?? partyId
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function loadSave(id: string) {
  ui.goToRestoring(id)
}
</script>

<template>
  <main class="flex h-screen w-screen flex-col items-center gap-6 overflow-y-auto bg-zinc-900 p-8 text-zinc-100">
    <div class="flex w-full max-w-2xl items-center justify-start">
      <button type="button" class="text-sm text-zinc-400 hover:text-zinc-100" @click="ui.goToTitle">
        ← Back
      </button>
    </div>

    <h1 class="text-3xl font-semibold">Load game</h1>

    <div class="w-full max-w-2xl space-y-2">
      <div
        v-for="entry in saves"
        :key="entry.id"
        class="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/80 px-4 py-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-zinc-100">
            {{ entry.kind === 'autosave' ? 'Autosave' : entry.label || entry.id }}
          </p>
          <p class="text-xs text-zinc-400">{{ entry.summary || partyLabel(entry.selectedPartyId) }}</p>
          <p class="text-xs text-zinc-500">Updated {{ formatDate(entry.updatedAt) }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900"
          @click="loadSave(entry.id)"
        >
          Load
        </button>
      </div>

      <p v-if="!saves.length" class="text-center text-sm text-zinc-500">No saves yet.</p>
    </div>
  </main>
</template>
