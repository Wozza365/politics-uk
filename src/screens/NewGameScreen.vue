<script setup lang="ts">
// New-game setup (P3.2 step 3, formerly the MVP's `StartScreen`): timeline selector + party cards
// + Start button. Starting over an active campaign confirms first (the single rolling autosave
// slot means a new campaign's first autosave would otherwise silently replace the previous one) —
// then the whole reset+first-autosave sequence runs through one orchestration action
// (`save.startNewGame`) rather than this screen poking `game`/`save` separately.
import { computed, ref } from 'vue'
import { useScenarioStore } from '@/stores/scenario'
import { useGameStore } from '@/stores/game'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'
import PartyCard from '@/components/PartyCard.vue'

// Driven from an array even though there's a single stop today (spec §7.1),
// so more timeline stops can be added later without restructuring this.
interface TimelineStop {
  scenarioId: string
  date: string
  label: string
}

const scenario = useScenarioStore()
const game = useGameStore()
const save = useSaveStore()
const ui = useUiStore()

const timelineStops: TimelineStop[] = [
  { scenarioId: scenario.scenario.id, date: scenario.scenario.date, label: '1 January 2025' },
]
const selectedStopIndex = ref(0)
const selectedStop = computed(() => timelineStops[selectedStopIndex.value])
const campaign = computed(() => scenario.scenario.campaign)
const objectiveSummary = computed(() => {
  const primary = campaign.value?.primaryObjectives.length ?? 0
  const optional = campaign.value?.optionalObjectives.filter((objective) => objective.kind !== 'hidden').length ?? 0
  return `${primary} primary objective${primary === 1 ? '' : 's'}, ${optional} optional objective${optional === 1 ? '' : 's'}`
})

const nationalParties = computed(() =>
  scenario.scenario.parties.filter((party) => party.scope === 'national'),
)

const selectedPartyId = ref<string | null>(null)

function selectParty(partyId: string) {
  selectedPartyId.value = partyId
}

async function startGame() {
  if (!selectedPartyId.value) return
  if (game.selectedPartyId) {
    const confirmed = await ui.requestConfirm({
      title: 'Start a new campaign?',
      message: 'You have an active campaign in progress. Starting a new one replaces its autosave — any manual saves you made are unaffected.',
      confirmLabel: 'Start new campaign',
    })
    if (!confirmed) return
  }
  await save.startNewGame(selectedPartyId.value)
  ui.goToLoading()
}
</script>

<template>
  <main class="flex h-screen w-screen flex-col items-center gap-8 overflow-y-auto bg-zinc-900 p-8 pb-[50px]">
    <div class="flex w-full max-w-5xl items-center justify-start">
      <button type="button" class="text-sm text-zinc-400 hover:text-zinc-100" @click="ui.goToTitle">
        ← Back
      </button>
    </div>

    <h1 class="text-3xl font-semibold text-zinc-100">New game</h1>

    <div class="flex w-full max-w-md flex-col items-center gap-2">
      <label for="timeline-slider" class="text-sm font-medium text-zinc-300">Scenario</label>
      <input
        id="timeline-slider"
        v-model.number="selectedStopIndex"
        type="range"
        min="0"
        :max="timelineStops.length - 1"
        step="1"
        :disabled="timelineStops.length <= 1"
        class="w-full"
      />
      <p class="text-lg text-zinc-100">{{ selectedStop.label }}</p>
    </div>

    <section
      v-if="campaign"
      class="grid w-full max-w-5xl gap-4 rounded-2xl border border-zinc-700/70 bg-zinc-950/70 p-5 text-sm text-zinc-300 shadow-xl sm:grid-cols-[1.4fr_1fr]"
      aria-label="Scenario briefing"
    >
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Scenario briefing</p>
        <h2 class="mt-1 text-xl font-semibold text-zinc-100">{{ campaign.briefing.headline }}</h2>
        <p class="mt-2 leading-6 text-zinc-300">{{ campaign.briefing.summary }}</p>
        <p class="mt-3 text-xs text-zinc-500">{{ campaign.electoralHorizon.description }}</p>
      </div>
      <div class="space-y-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Horizon</p>
          <p class="mt-1 text-zinc-100">{{ campaign.electoralHorizon.expectedEndDate }}</p>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Difficulty</p>
          <p class="mt-1 text-zinc-100">{{ objectiveSummary }}</p>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Content notes</p>
          <p class="mt-1 text-xs text-zinc-400">{{ campaign.briefing.assumptions[0] }}</p>
          <p class="mt-1 text-xs text-zinc-400">{{ campaign.briefing.fictionalPremises[0] }}</p>
        </div>
      </div>
    </section>

    <div class="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <PartyCard
        v-for="party in nationalParties"
        :key="party.id"
        :party="party"
        :selected="selectedPartyId === party.id"
        @select="selectParty"
      />
    </div>

    <button
      type="button"
      class="rounded-md bg-zinc-100 px-8 py-3 text-lg font-semibold text-zinc-900 transition disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-400"
      :disabled="!selectedPartyId"
      @click="startGame"
    >
      Start
    </button>
  </main>
</template>
