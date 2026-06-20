<script setup lang="ts">
// Start menu (spec §7): timeline selector + party cards + Start button.
import { computed, ref } from 'vue'
import { useScenarioStore } from '@/stores/scenario'
import { useGameStore } from '@/stores/game'
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
const ui = useUiStore()

const timelineStops: TimelineStop[] = [
  { scenarioId: scenario.scenario.id, date: scenario.scenario.date, label: '1 January 2025' },
]
const selectedStopIndex = ref(0)
const selectedStop = computed(() => timelineStops[selectedStopIndex.value])

const nationalParties = computed(() =>
  scenario.scenario.parties.filter((party) => party.scope === 'national'),
)

const selectedPartyId = ref<string | null>(null)

function selectParty(partyId: string) {
  selectedPartyId.value = partyId
}

function startGame() {
  if (!selectedPartyId.value) return
  game.startGame(selectedPartyId.value)
  ui.goToLoading()
}
</script>

<template>
  <main class="flex h-screen w-screen flex-col items-center gap-8 overflow-y-auto bg-zinc-900 p-8">
    <h1 class="text-3xl font-semibold text-zinc-100">Politics UK</h1>

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
