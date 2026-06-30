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

const autosave = computed(() =>
  save.saves.find((entry) => entry.kind === 'autosave' && entry.scenarioId === scenario.scenario.id),
)

const campaign = computed(() => scenario.scenario.campaign)

const continuePartyLabel = computed(() => {
  const partyId = autosave.value?.selectedPartyId
  if (!partyId) return null
  return scenario.party(partyId)?.shortName ?? partyId
})

const continueSummary = computed(() => {
  if (!autosave.value) return 'No active campaign found'
  return autosave.value.summary || continuePartyLabel.value || 'Campaign in progress'
})

function formatIsoDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function continueGame() {
  if (!autosave.value) return
  ui.goToRestoring(autosave.value.id)
}
</script>

<template>
  <main class="puk-screen-shell overflow-y-auto">
    <section
      class="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-rows-[1fr_auto] gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-1 lg:gap-10 lg:py-8"
    >
      <div class="flex min-h-[34rem] flex-col justify-between gap-10 py-4 lg:py-10">
        <div class="max-w-3xl">
          <p class="puk-screen-kicker">Election operations desk</p>
          <h1 class="mt-4 text-5xl font-black leading-none tracking-normal text-puk-text sm:text-7xl">
            Politics UK
          </h1>
          <p class="mt-5 max-w-2xl text-base leading-7 text-puk-text-muted sm:text-lg">
            Run the map room, set the campaign rhythm, and turn polling pressure into seats before the country votes.
          </p>
        </div>

        <dl class="grid max-w-4xl gap-3 sm:grid-cols-3">
          <div class="puk-stat-tile">
            <dt class="puk-stat-label">Scenario</dt>
            <dd class="puk-stat-value mt-2 text-lg font-semibold">{{ formatIsoDate(scenario.scenario.date) }}</dd>
          </div>
          <div class="puk-stat-tile">
            <dt class="puk-stat-label">Horizon</dt>
            <dd class="puk-stat-value mt-2 text-lg font-semibold">
              {{ campaign?.electoralHorizon.label ?? 'General election' }}
            </dd>
          </div>
          <div class="puk-stat-tile">
            <dt class="puk-stat-label">Save protocol</dt>
            <dd class="puk-stat-value mt-2 text-lg font-semibold">Format v{{ CURRENT_SAVE_FORMAT_VERSION }}</dd>
          </div>
        </dl>
      </div>

      <aside
        class="puk-screen-panel flex h-fit flex-col gap-5 p-4 sm:p-5 lg:sticky lg:top-8 lg:mt-auto lg:mb-8"
        aria-label="Main menu"
      >
        <div class="border-b border-puk-border-subtle pb-4">
          <p class="puk-screen-kicker">Command menu</p>
          <h2 class="mt-2 text-xl font-semibold leading-tight text-puk-text">Choose a desk</h2>
        </div>

        <nav class="flex flex-col gap-3" aria-label="Main menu actions">
          <button
            v-if="autosave"
            type="button"
            class="puk-command-action puk-command-action--primary"
            @click="continueGame"
          >
            <span class="min-w-0">
              <span class="block text-sm font-bold">Continue campaign</span>
              <span class="mt-1 block truncate text-xs text-puk-text-muted">
                {{ continueSummary }} - {{ formatIsoDate(autosave.date) }}
              </span>
            </span>
            <span class="text-lg" aria-hidden="true">-></span>
          </button>

          <button
            type="button"
            class="puk-command-action puk-command-action--secondary"
            @click="ui.goToNewGame"
          >
            <span>
              <span class="block text-sm font-bold">New campaign</span>
              <span class="mt-1 block text-xs text-puk-text-muted">Briefing, party, timeline</span>
            </span>
            <span aria-hidden="true">+</span>
          </button>

          <button
            type="button"
            class="puk-command-action puk-command-action--secondary"
            @click="ui.goToLoadGame"
          >
            <span>
              <span class="block text-sm font-bold">Load campaign</span>
              <span class="mt-1 block text-xs text-puk-text-muted">Autosave and manual slots</span>
            </span>
            <span aria-hidden="true">#</span>
          </button>

          <button
            type="button"
            class="puk-command-action puk-command-action--disabled"
            disabled
            aria-disabled="true"
          >
            <span>
              <span class="block text-sm font-bold">Settings</span>
              <span class="mt-1 block text-xs">Not available in this build</span>
            </span>
            <span aria-hidden="true">-</span>
          </button>
        </nav>

        <div class="rounded-[var(--puk-radius-card)] border border-puk-border-subtle bg-puk-map-backdrop/60 p-3 text-xs text-puk-text-muted">
          <p v-if="autosave">
            Last autosave updated {{ formatDateTime(autosave.updatedAt) }}.
          </p>
          <p v-else>
            No rolling autosave exists for this scenario.
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>
