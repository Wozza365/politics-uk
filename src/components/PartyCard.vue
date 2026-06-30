<script setup lang="ts">
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

const partyMark = computed(() => props.party.shortName.replace(/\s+/g, '').slice(0, 4))

function formatPct(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`
}
</script>

<template>
  <button
    type="button"
    class="puk-party-card flex w-full flex-col p-4 pl-5 text-left outline-none"
    :class="selected ? 'puk-party-card--selected' : ''"
    :style="{ '--party-accent': party.colours.primary, '--party-on-accent': party.colours.onPrimary }"
    :aria-pressed="selected"
    :aria-label="`${selected ? 'Selected' : 'Select'} ${party.name}`"
    @click="emit('select', party.id)"
  >
    <span class="relative z-10 flex items-start justify-between gap-3">
      <span class="flex min-w-0 items-center gap-3">
        <span class="puk-party-mark shrink-0">{{ partyMark }}</span>
        <span class="min-w-0">
          <span class="block truncate text-lg font-black leading-tight text-puk-text">{{ party.name }}</span>
          <span class="mt-1 block truncate text-sm font-medium text-puk-text-muted">
            {{ leader?.personName ?? 'Leader TBC' }}
          </span>
        </span>
      </span>
      <span class="puk-status-pill shrink-0" :class="selected ? 'puk-status-pill--selected' : ''">
        <span aria-hidden="true">{{ selected ? '✓' : '+' }}</span>
        <span>{{ selected ? 'Selected' : 'Pick' }}</span>
      </span>
    </span>

    <dl class="relative z-10 mt-5 grid grid-cols-2 gap-2 text-sm">
      <div class="puk-stat-tile">
        <dt class="puk-stat-label">Commons</dt>
        <dd class="puk-stat-value mt-2 text-xl font-black">{{ commonsSeats }}</dd>
      </div>
      <div class="puk-stat-tile">
        <dt class="puk-stat-label">Polling</dt>
        <dd class="puk-stat-value mt-2 text-xl font-black">{{ formatPct(pollingPct) }}</dd>
      </div>
    </dl>

    <div class="relative z-10 mt-auto flex items-end justify-between gap-3 pt-5">
      <div class="text-puk-text" :style="{ color: party.colours.primary }">
        <DifficultyBadge :band="difficultyBand" />
      </div>
      <div
        v-if="compassItems.length"
        class="rounded-[var(--puk-radius-card)] border border-puk-border-subtle bg-puk-map-backdrop/70 p-1 text-puk-text-muted"
      >
        <CompassView :items="compassItems" compact />
      </div>
    </div>
  </button>
</template>
