<script setup lang="ts">
// New-game party card (spec §7.2). Renders whatever party it's given — the
// parent (NewGameScreen) is responsible for filtering to scope === 'national'.
import { computed } from 'vue'
import type { Party } from '@/types'
import { useScenarioStore } from '@/stores/scenario'
import { computeDifficulty } from '@/sim/difficulty'
import CompassView from './CompassView.vue'
import DifficultyBadge from './DifficultyBadge.vue'

const props = defineProps<{
  party: Party
  selected?: boolean
}>()

const emit = defineEmits<{
  select: [partyId: string]
}>()

const scenario = useScenarioStore()

const leader = computed(() => props.party.leadership.find((officer) => officer.role === 'leader'))

const commonsSeats = computed(
  () =>
    scenario.commonsRegions.filter((region) =>
      region.seats.some((seat) => seat.party === props.party.id),
    ).length,
)

const pollingPct = computed(() => scenario.scenario.polling[props.party.id] ?? 0)

const difficultyBand = computed(() => computeDifficulty(props.party, scenario.scenario))

const compassItems = computed(() => {
  if (!props.party.compass) return []
  return [
    {
      position: props.party.compass.position,
      consistency: props.party.compass.consistency,
      colour: props.party.colours.primary,
      label: props.party.id,
    },
  ]
})
</script>

<template>
  <button
    type="button"
    class="flex w-full flex-col gap-3 rounded-lg p-4 text-left shadow-md transition outline-none"
    :class="selected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''"
    :style="{ backgroundColor: party.colours.primary, color: party.colours.onPrimary }"
    @click="emit('select', party.id)"
  >
    <div class="flex items-start justify-between gap-2">
      <h3 class="text-lg font-bold">{{ party.name }}</h3>
      <CompassView v-if="compassItems.length" :items="compassItems" compact />
    </div>

    <p class="text-sm font-medium opacity-90">{{ leader?.personName ?? '—' }}</p>

    <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
      <dt class="opacity-75">Commons seats</dt>
      <dd class="text-right font-semibold">{{ commonsSeats }}</dd>

      <dt class="opacity-75">Devolved seats</dt>
      <dd class="text-right font-semibold">—</dd>

      <dt class="opacity-75">Council seats</dt>
      <dd class="text-right font-semibold">—</dd>

      <dt class="opacity-75">Polling</dt>
      <dd class="text-right font-semibold">{{ pollingPct }}%</dd>
    </dl>

    <DifficultyBadge :band="difficultyBand" />
  </button>
</template>
