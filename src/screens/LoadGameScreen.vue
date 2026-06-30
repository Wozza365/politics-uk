<script setup lang="ts">
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

const saves = computed(() =>
  [...save.saves]
    .filter((entry) => entry.scenarioId === scenario.scenario.id)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
)

function partyLabel(partyId: string | null) {
  if (!partyId) return 'No party selected'
  return scenario.party(partyId)?.shortName ?? partyId
}

function partyName(partyId: string | null) {
  if (!partyId) return 'Campaign'
  return scenario.party(partyId)?.name ?? partyId
}

function partyColour(partyId: string | null) {
  return partyId ? scenario.party(partyId)?.colours.primary ?? 'var(--puk-color-data-neutral)' : 'var(--puk-color-data-neutral)'
}

function partyOnColour(partyId: string | null) {
  return partyId ? scenario.party(partyId)?.colours.onPrimary ?? '#101114' : '#101114'
}

function slotLabel(kind: string, label: string | undefined, id: string) {
  if (kind === 'autosave') return 'Autosave'
  return label || `Manual slot ${id.slice(0, 8)}`
}

function formatGameDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isCompatible(formatVersion: number) {
  return formatVersion === CURRENT_SAVE_FORMAT_VERSION
}

function loadSave(id: string, formatVersion: number) {
  if (!isCompatible(formatVersion)) return
  ui.goToRestoring(id)
}
</script>

<template>
  <main class="puk-screen-shell overflow-y-auto">
    <section class="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          class="rounded-[var(--puk-radius-control)] border border-puk-border px-3 py-2 text-sm font-semibold text-puk-text-muted transition hover:bg-puk-surface-raised hover:text-puk-text"
          @click="ui.goToTitle"
        >
          <- Back
        </button>
        <div class="text-right">
          <p class="puk-screen-kicker">Campaign archive</p>
          <h1 class="mt-1 text-2xl font-bold text-puk-text sm:text-3xl">Load campaign</h1>
        </div>
      </header>

      <section class="puk-screen-panel overflow-hidden">
        <div class="border-b border-puk-border-subtle p-5">
          <p class="text-sm leading-6 text-puk-text-muted">
            Compatible saves for {{ scenario.scenario.label }}.
          </p>
        </div>

        <div v-if="saves.length" class="divide-y divide-puk-border-subtle">
          <article
            v-for="entry in saves"
            :key="entry.id"
            class="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5"
          >
            <div
              class="puk-save-thumbnail"
              :style="{ '--party-accent': partyColour(entry.selectedPartyId), '--party-on-accent': partyOnColour(entry.selectedPartyId) }"
              aria-hidden="true"
            >
              <span
                class="relative z-10 rounded-[var(--puk-radius-card)] px-2 py-1 text-xs font-black"
                :style="{ backgroundColor: partyColour(entry.selectedPartyId), color: partyOnColour(entry.selectedPartyId) }"
              >
                {{ partyLabel(entry.selectedPartyId) }}
              </span>
            </div>

            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate text-base font-bold text-puk-text">
                  {{ slotLabel(entry.kind, entry.label, entry.id) }}
                </h2>
                <span
                  class="puk-status-pill"
                  :class="isCompatible(entry.formatVersion) ? 'puk-status-pill--selected' : ''"
                >
                  <span aria-hidden="true">{{ isCompatible(entry.formatVersion) ? 'OK' : '!' }}</span>
                  <span>{{ isCompatible(entry.formatVersion) ? 'Compatible' : 'Unsupported' }}</span>
                </span>
              </div>
              <p class="mt-2 truncate text-sm text-puk-text">
                {{ partyName(entry.selectedPartyId) }} - {{ formatGameDate(entry.date) }}
              </p>
              <p class="mt-1 text-xs leading-5 text-puk-text-muted">
                {{ entry.summary || partyLabel(entry.selectedPartyId) }} / Updated {{ formatDateTime(entry.updatedAt) }} / Save v{{ entry.formatVersion }}
              </p>
            </div>

            <button
              type="button"
              class="rounded-[var(--puk-radius-control)] border border-puk-player-focus/60 bg-puk-player-focus/15 px-4 py-2 text-sm font-bold text-puk-text transition hover:bg-puk-player-focus/25 disabled:cursor-not-allowed disabled:border-puk-border disabled:bg-puk-surface disabled:text-puk-text-disabled"
              :disabled="!isCompatible(entry.formatVersion)"
              @click="loadSave(entry.id, entry.formatVersion)"
            >
              Load
            </button>
          </article>
        </div>

        <div v-else class="grid min-h-72 place-items-center p-6 text-center">
          <div class="max-w-sm">
            <p class="puk-screen-kicker">No save slots</p>
            <h2 class="mt-2 text-xl font-bold text-puk-text">No campaigns saved yet</h2>
            <p class="mt-3 text-sm leading-6 text-puk-text-muted">
              Start a new campaign to create the rolling autosave slot, then return here to restore it.
            </p>
            <button
              type="button"
              class="mt-5 rounded-[var(--puk-radius-control)] border border-puk-border px-4 py-2 text-sm font-semibold text-puk-text transition hover:bg-puk-surface-raised"
              @click="ui.goToNewGame"
            >
              New campaign
            </button>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>
