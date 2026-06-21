<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import { computeHemicycleLayout, getHemicycleDotPosition } from '@/sim/hemicycle'

const gameStore = useGameStore()
const scenarioStore = useScenarioStore()

const VIEWPORT_WIDTH = 500
const VIEWPORT_HEIGHT = 200
const DOT_RADIUS = 5
const SEATS_PER_DOT = 1

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
  const seatCounts = gameStore.commonsSeatsByParty
  const parties: PartyWithSeats[] = []

  for (const party of scenarioStore.scenario.parties) {
    const seats = seatCounts[party.id] ?? 0
    if (seats > 0) {
      parties.push({
        id: party.id,
        name: party.name,
        shortName: party.shortName,
        colour: party.colours.primary,
        seats,
        economicPosition: party.compass?.position.economic ?? 0,
      })
    }
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

// Build the SVG dots for the hemicycle
const dots = computed(() => {
  const totalSeats = totalSeatCount.value
  const layout = computeHemicycleLayout(totalSeats, SEATS_PER_DOT)
  const result: Array<{
    id: string
    partyId: string
    partyName: string
    x: number
    y: number
    colour: string
    seatIndex: number
  }> = []

  let globalSeatIndex = 0

  for (const party of partiesWithSeats.value) {
    for (let i = 0; i < party.seats; i++) {
      const position = getHemicycleDotPosition(
        globalSeatIndex,
        layout.rows,
        VIEWPORT_WIDTH,
        VIEWPORT_HEIGHT,
      )

      result.push({
        id: `${party.id}-${i}`,
        partyId: party.id,
        partyName: party.name,
        x: position.x,
        y: position.y,
        colour: party.colour,
        seatIndex: globalSeatIndex,
      })

      globalSeatIndex++
    }
  }

  return result
})

const totalSeats = computed(() => gameStore.commonsSeatsByParty)
const totalSeatCount = computed(() =>
  Object.values(totalSeats.value).reduce((sum, count) => sum + count, 0),
)
</script>

<template>
  <div class="flex h-full w-full flex-col items-center justify-center gap-4">
    <svg
      :width="VIEWPORT_WIDTH"
      :height="VIEWPORT_HEIGHT"
      viewBox="0 0 500 200"
      class="drop-shadow-lg"
    >
      <!-- Render dots -->
      <g class="hemicycle-dots">
        <circle
          v-for="dot of dots"
          :key="dot.id"
          :cx="dot.x"
          :cy="dot.y"
          :r="DOT_RADIUS"
          :fill="dot.colour"
          :data-party="dot.partyId"
          class="cursor-pointer opacity-90 transition-opacity hover:opacity-100"
        >
          <title>{{ dot.partyName }} · Seat {{ dot.seatIndex + 1 }}</title>
        </circle>
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
</template>
