<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import { useUiStore } from '@/stores/ui'
import { buildHemicycleSlots, computeHemicycleLayout, slotToPosition } from '@/sim/hemicycle'

const gameStore = useGameStore()
const scenarioStore = useScenarioStore()
const uiStore = useUiStore()

const VIEWPORT_WIDTH = 500
const VIEWPORT_HEIGHT = 200
const DOT_RADIUS = 2.5
const HOVER_HIT_RADIUS = DOT_RADIUS * 2.2 // bigger than the visible dot, for an easier hover target

// NI's parties are grouped into a single "NI" slice for this view (they're
// still tracked individually elsewhere in the data model); the Speaker is
// shown merged into Independent rather than as their own slice.
const NI_PARTY_IDS = ['dup', 'sinn_fein', 'sdlp', 'alliance', 'uup', 'tuv']
const NI_GROUP_COLOUR = '#6B5B95'
const SPEAKER_PARTY_ID = 'speaker'
const INDEPENDENT_PARTY_ID = 'independent'

function activeSeatCounts() {
  if (uiStore.activeView === 'westminster') return gameStore.commonsSeatsByParty

  const counts: Record<string, number> = {}
  const tierEntries =
    uiStore.activeView === 'regional'
      ? Object.entries(scenarioStore.scenario.tiers).filter(([tierId]) =>
          ['holyrood', 'senedd', 'ni_assembly', 'london_assembly'].includes(tierId),
        )
      : [['councils', scenarioStore.councilRegionsForLevel(uiStore.activeCouncilLevel)] as const]

  for (const [, regions] of tierEntries) {
    for (const seat of regions.flatMap((region) => region.seats)) {
      counts[seat.party] = (counts[seat.party] ?? 0) + 1
    }
  }
  return counts
}

interface PartyWithSeats {
  id: string
  name: string
  shortName: string
  colour: string
  seats: number
  economicPosition: number
}

// Compute ordered list of parties with seat counts
const partiesWithSeats = computed(() => {
  const seatCounts = activeSeatCounts()
  const parties: PartyWithSeats[] = []

  let niSeats = 0
  let independentSeats = 0

  for (const party of scenarioStore.scenario.parties) {
    const seats = seatCounts[party.id] ?? 0
    if (seats === 0) continue

    if (NI_PARTY_IDS.includes(party.id)) {
      niSeats += seats
      continue
    }
    if (party.id === SPEAKER_PARTY_ID) {
      independentSeats += seats
      continue
    }
    if (party.id === INDEPENDENT_PARTY_ID) {
      independentSeats += seats
      continue
    }

    parties.push({
      id: party.id,
      name: party.name,
      shortName: party.shortName,
      colour: party.colours.primary,
      seats,
      economicPosition: party.compass?.position.economic ?? 0,
    })
  }

  if (niSeats > 0) {
    parties.push({
      id: 'ni',
      name: 'Northern Ireland parties',
      shortName: 'NI',
      colour: NI_GROUP_COLOUR,
      seats: niSeats,
      economicPosition: 0,
    })
  }

  if (independentSeats > 0) {
    const independentParty = scenarioStore.party(INDEPENDENT_PARTY_ID)
    parties.push({
      id: INDEPENDENT_PARTY_ID,
      name: independentParty?.name ?? 'Independent',
      shortName: independentParty?.shortName ?? 'Ind',
      colour: independentParty?.colours.primary ?? '#909090',
      seats: independentSeats,
      economicPosition: independentParty?.compass?.position.economic ?? 0,
    })
  }

  // Order by economic position (left to right), or by seat count descending if no position
  parties.sort((a, b) => {
    const aPosValid = a.economicPosition !== undefined
    const bPosValid = b.economicPosition !== undefined

    if (aPosValid && bPosValid) {
      return a.economicPosition - b.economicPosition
    }

    if (aPosValid) return -1
    if (bPosValid) return 1

    return b.seats - a.seats
  })

  return parties
})

// Build the SVG dots for the hemicycle. Fill order sweeps clockwise across
// the whole fan (not ring-by-ring), assigning the leftmost contiguous wedge
// of slots to the largest party, then the next wedge clockwise to the next
// largest, and so on — the way real hemicycle seating charts are drawn.
const dots = computed(() => {
  const partiesBySize = [...partiesWithSeats.value].sort((a, b) => b.seats - a.seats)
  const partyDotCounts = partiesBySize.map((party) => Math.max(1, Math.ceil(party.seats / seatsPerDot.value)))
  const totalDots = partyDotCounts.reduce((sum, count) => sum + count, 0)
  const layout = computeHemicycleLayout(totalDots, 1)
  const slots = buildHemicycleSlots(layout.rows)

  const result: Array<{
    id: string
    partyId: string
    partyName: string
    x: number
    y: number
    colour: string
    seatIndex: number
    partySeatTotal: number
  }> = []

  let slotIndex = 0

  partiesBySize.forEach((party, partyIndex) => {
    for (let i = 0; i < partyDotCounts[partyIndex]; i++) {
      const slot = slots[slotIndex]
      const position = slotToPosition(slot, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)

      result.push({
        id: `${party.id}-${i}`,
        partyId: party.id,
        partyName: party.name,
        x: position.x,
        y: position.y,
        colour: party.colour,
        seatIndex: slotIndex,
        partySeatTotal: party.seats,
      })

      slotIndex++
    }
  })

  return result
})

const totalSeats = computed(() => activeSeatCounts())
const totalSeatCount = computed(() =>
  Object.values(totalSeats.value).reduce((sum, count) => sum + count, 0),
)
const seatsPerDot = computed(() => {
  if (totalSeatCount.value > 5_000) return 100
  if (totalSeatCount.value > 900) return 10
  return 1
})

// View-mode toggle (P2 stub): will switch between the hemicycle dot fan (⌒)
// and a "house" view (=) — see GAME_SPEC.md §9.2. No behaviour yet, just the
// affordance and its icon state.
const isHemicycleMode = ref(true)
function toggleViewMode() {
  isHemicycleMode.value = !isHemicycleMode.value
}

// Hovering any one seat highlights every seat held by that party/group.
const hoveredPartyId = ref<string | null>(null)

// Collapsible, same pattern (and clock pause/resume) as PartyPanel.
const isExpanded = ref(false)
function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    gameStore.pauseClock()
  } else {
    gameStore.resumeClock()
  }
}

const largestParty = computed(() => {
  const list = [...partiesWithSeats.value].sort((a, b) => b.seats - a.seats)
  return list[0] ?? null
})
</script>

<template>
  <div class="flex w-full flex-col">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-900/40"
      :aria-expanded="isExpanded"
      aria-label="Toggle party makeup panel"
      @click="toggleExpanded"
    >
      <p class="text-sm font-semibold tracking-wide text-zinc-100">Party makeup</p>
      <p class="flex items-center gap-3 text-xs text-zinc-400">
        <span v-if="largestParty">
          Largest: <span class="font-semibold text-zinc-100">{{ largestParty.shortName }}</span>
          ({{ largestParty.seats }})
        </span>
        <span>{{ totalSeatCount }} seats</span>
        <span class="text-zinc-100">{{ isExpanded ? '˄' : '˅' }}</span>
      </p>
    </button>

    <div v-if="isExpanded" class="relative flex flex-col items-center justify-center gap-4 px-4 pb-4">
      <button
        type="button"
        role="switch"
        :aria-checked="isHemicycleMode"
        class="absolute left-2 top-2 z-10 inline-flex h-8 w-16 items-center rounded-full bg-zinc-800/80 px-1.5 transition-colors hover:bg-zinc-700/80"
        :aria-label="isHemicycleMode ? 'Switch to house view' : 'Switch to hemicycle view'"
        title="Switch view (not yet functional)"
        @click="toggleViewMode"
      >
        <span class="pointer-events-none flex w-full items-center justify-between px-2 text-base leading-none text-zinc-400">
          <span>⌒</span>
          <span>=</span>
        </span>
        <span
          class="pointer-events-none absolute left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-base leading-none text-zinc-900 shadow transition-transform"
          :class="isHemicycleMode ? 'translate-x-0' : 'translate-x-[2.25rem]'"
        >
          {{ isHemicycleMode ? '⌒' : '=' }}
        </span>
      </button>

      <svg
        :width="VIEWPORT_WIDTH"
        :height="VIEWPORT_HEIGHT"
        viewBox="0 0 500 200"
        class="drop-shadow-lg"
      >
        <!-- Render dots -->
        <g class="hemicycle-dots">
          <g v-for="dot of dots" :key="dot.id">
            <!-- Invisible hit target, slightly larger than the visible dot -->
            <circle
              :cx="dot.x"
              :cy="dot.y"
              :r="HOVER_HIT_RADIUS"
              fill="transparent"
              :data-party="dot.partyId"
              class="cursor-pointer"
              @mouseenter="hoveredPartyId = dot.partyId"
              @mouseleave="hoveredPartyId = null"
            >
              <title>{{ dot.partyName }} · {{ dot.partySeatTotal }} seats</title>
            </circle>
            <!-- Visible dot. Hover "grow" uses a CSS transform (compositor-only)
                 rather than changing the SVG r attribute, which would force a
                 geometry relayout on every hover change. -->
            <circle
              :cx="dot.x"
              :cy="dot.y"
              :r="DOT_RADIUS"
              :fill="dot.colour"
              class="pointer-events-none transition-[opacity,filter,transform] duration-100 [transform-box:fill-box] [transform-origin:center]"
              :class="
                hoveredPartyId === null
                  ? 'opacity-90'
                  : hoveredPartyId === dot.partyId
                    ? 'scale-[1.2] opacity-100'
                    : 'opacity-20'
              "
              :style="hoveredPartyId === dot.partyId ? 'filter: brightness(1.2) saturate(1.2)' : ''"
            />
          </g>
        </g>
      </svg>

      <!-- Legend -->
      <div class="flex flex-wrap items-center justify-center gap-4">
        <div v-for="party of partiesWithSeats" :key="party.id" class="flex items-center gap-2">
          <div :style="{ backgroundColor: party.colour }" class="h-3 w-3 rounded-full"></div>
          <span class="text-xs font-medium">{{ party.shortName }} ({{ party.seats }})</span>
        </div>
      </div>

      <p class="text-xs text-zinc-500">Total: {{ totalSeatCount }} seats</p>
    </div>
  </div>
</template>
