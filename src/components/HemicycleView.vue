<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import { useUiStore } from '@/stores/ui'
import { buildHemicycleSlots, computeHemicycleLayout, computeHouseSlots, slotToPosition } from '@/sim/hemicycle'
import type { CandidateResult, Region, Seat } from '@/types'

const gameStore = useGameStore()
const scenarioStore = useScenarioStore()
const uiStore = useUiStore()

const VIEWPORT_WIDTH = 500
const VIEWPORT_HEIGHT = 200
const DOT_RADIUS = 2.5
const HOVER_HIT_RADIUS = DOT_RADIUS * 2.2

const NI_PARTY_IDS = ['dup', 'sinn_fein', 'sdlp', 'alliance', 'uup', 'tuv']
const NI_GROUP_COLOUR = '#6B5B95'
const SPEAKER_PARTY_ID = 'speaker'
const INDEPENDENT_PARTY_ID = 'independent'

interface SeatDetail {
  id: string
  party: string
  regionName: string
  tier: string
  memberName?: string
  majority?: number
  voteShare?: number
  electedAt?: string
  turnout?: number
  electorate?: number
  wardName?: string
  nextElection?: string
  seatType?: Seat['seatType']
  results?: CandidateResult[]
}

interface PartyWithSeats {
  id: string
  name: string
  shortName: string
  colour: string
  seats: number
  economicPosition: number
  seatDetails: SeatDetail[]
}

function groupedPartyId(partyId: string) {
  if (NI_PARTY_IDS.includes(partyId)) return 'ni'
  if (partyId === SPEAKER_PARTY_ID) return INDEPENDENT_PARTY_ID
  return partyId
}

function seatDetail(region: Region, seat: Seat, seatIndex: number): SeatDetail {
  return {
    id: `${region.tier}:${region.id}:${seatIndex}`,
    party: groupedPartyId(seat.party),
    regionName: region.name,
    tier: region.tier,
    memberName: seat.memberName,
    majority: seat.majority,
    voteShare: seat.voteShare,
    electedAt: seat.electedAt,
    turnout: seat.turnout,
    electorate: seat.electorate,
    wardName: seat.wardName,
    nextElection: seat.nextElection,
    seatType: seat.seatType,
    results: seat.results,
  }
}

function seatDetailsForRegions(regions: Region[]) {
  const details: SeatDetail[] = []
  for (const region of regions) {
    for (const [seatIndex, seat] of region.seats.entries()) {
      details.push(seatDetail(region, seat, seatIndex))
    }
  }
  return details
}

const activeSeatDetails = computed(() => {
  if (uiStore.activeView === 'westminster') return seatDetailsForRegions(scenarioStore.commonsRegions)

  const regions =
    uiStore.activeView === 'regional'
      ? ['holyrood', 'senedd', 'ni_assembly', 'london_assembly'].flatMap(
          (tierId) => scenarioStore.scenario.tiers[tierId] ?? [],
        )
      : scenarioStore.councilRegionsForLevel(uiStore.activeCouncilLevel)

  return seatDetailsForRegions(regions)
})

const activeViewLabel = computed(() => {
  if (uiStore.activeView === 'westminster') return 'Westminster'
  if (uiStore.activeView === 'regional') return 'Regional parliaments'
  return uiStore.activeCouncilLevel === 'county' ? 'County councils' : 'Local councils'
})

const partiesWithSeats = computed(() => {
  const seatsByParty = new Map<string, SeatDetail[]>()
  for (const detail of activeSeatDetails.value) {
    const seats = seatsByParty.get(detail.party) ?? []
    seats.push(detail)
    seatsByParty.set(detail.party, seats)
  }

  const parties: PartyWithSeats[] = []
  for (const party of scenarioStore.scenario.parties) {
    if (NI_PARTY_IDS.includes(party.id) || party.id === SPEAKER_PARTY_ID) continue
    const seatDetails = seatsByParty.get(party.id) ?? []
    if (seatDetails.length === 0) continue

    parties.push({
      id: party.id,
      name: party.name,
      shortName: party.shortName,
      colour: party.colours.primary,
      seats: seatDetails.length,
      economicPosition: party.compass?.position.economic ?? 0,
      seatDetails,
    })
  }

  const niSeatDetails = seatsByParty.get('ni') ?? []
  if (niSeatDetails.length > 0) {
    parties.push({
      id: 'ni',
      name: 'Northern Ireland parties',
      shortName: 'NI',
      colour: NI_GROUP_COLOUR,
      seats: niSeatDetails.length,
      economicPosition: 0,
      seatDetails: niSeatDetails,
    })
  }

  const independentSeatDetails = seatsByParty.get(INDEPENDENT_PARTY_ID) ?? []
  if (independentSeatDetails.length > 0) {
    const independentParty = scenarioStore.party(INDEPENDENT_PARTY_ID)
    parties.push({
      id: INDEPENDENT_PARTY_ID,
      name: independentParty?.name ?? 'Independent',
      shortName: independentParty?.shortName ?? 'Ind',
      colour: independentParty?.colours.primary ?? '#909090',
      seats: independentSeatDetails.length,
      economicPosition: independentParty?.compass?.position.economic ?? 0,
      seatDetails: independentSeatDetails,
    })
  }

  parties.sort((a, b) => a.economicPosition - b.economicPosition || b.seats - a.seats)
  return parties
})

const totalSeatCount = computed(() => activeSeatDetails.value.length)
const seatsPerDot = computed(() => {
  if (totalSeatCount.value > 5_000) return 100
  if (totalSeatCount.value > 900) return 10
  return 1
})

const isHemicycleMode = ref(true)
function toggleViewMode() {
  isHemicycleMode.value = !isHemicycleMode.value
}

const dots = computed(() => {
  const partiesBySize = [...partiesWithSeats.value].sort((a, b) => b.seats - a.seats)
  const partyDotCounts = partiesBySize.map((party) => Math.max(1, Math.ceil(party.seats / seatsPerDot.value)))
  const totalDots = partyDotCounts.reduce((sum, count) => sum + count, 0)
  const slots = isHemicycleMode.value
    ? buildHemicycleSlots(computeHemicycleLayout(totalDots, 1).rows).map((slot) =>
        slotToPosition(slot, VIEWPORT_WIDTH, VIEWPORT_HEIGHT),
      )
    : computeHouseSlots(totalDots, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, DOT_RADIUS)

  const result: Array<{
    id: string
    partyId: string
    partyName: string
    x: number
    y: number
    colour: string
    seatIndex: number
    partySeatTotal: number
    representedSeats: SeatDetail[]
  }> = []

  let slotIndex = 0
  partiesBySize.forEach((party, partyIndex) => {
    for (let i = 0; i < partyDotCounts[partyIndex]; i++) {
      const slot = slots[slotIndex]
      result.push({
        id: `${party.id}-${i}`,
        partyId: party.id,
        partyName: party.name,
        x: slot.x,
        y: slot.y,
        colour: party.colour,
        seatIndex: slotIndex,
        partySeatTotal: party.seats,
        representedSeats: party.seatDetails.slice(i * seatsPerDot.value, (i + 1) * seatsPerDot.value),
      })

      slotIndex++
    }
  })

  return result
})

const hoveredPartyId = ref<string | null>(null)
const selectedPartyId = ref<string | null>(null)
const selectedDotId = ref<string | null>(null)

const selectedParty = computed(() => partiesWithSeats.value.find((party) => party.id === selectedPartyId.value) ?? null)
const selectedDot = computed(() => dots.value.find((dot) => dot.id === selectedDotId.value) ?? null)
const selectedSeats = computed(() => selectedParty.value?.seatDetails ?? [])
const visibleSelectedSeats = computed(() => selectedSeats.value.slice(0, 120))
const selectedDotSeats = computed(() => selectedDot.value?.representedSeats ?? [])

function selectedTopResult(detail: SeatDetail) {
  return detail.results?.[0]
}

function selectDot(dot: { id: string; partyId: string }) {
  selectedPartyId.value = dot.partyId
  selectedDotId.value = dot.id
}

function clearSelection() {
  selectedPartyId.value = null
  selectedDotId.value = null
}

const isExpanded = ref(false)
function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    gameStore.pauseClock()
  } else {
    clearSelection()
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
        title="Switch view"
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
        <g class="hemicycle-dots">
          <g v-for="dot of dots" :key="dot.id">
            <circle
              :cx="dot.x"
              :cy="dot.y"
              :r="HOVER_HIT_RADIUS"
              fill="transparent"
              :data-party="dot.partyId"
              class="cursor-pointer"
              tabindex="0"
              role="button"
              :aria-label="`${dot.partyName}: ${dot.partySeatTotal} seats in ${activeViewLabel}`"
              @click="selectDot(dot)"
              @keydown.enter.prevent="selectDot(dot)"
              @keydown.space.prevent="selectDot(dot)"
              @mouseenter="hoveredPartyId = dot.partyId"
              @mouseleave="hoveredPartyId = null"
            >
              <title>{{ dot.partyName }} · {{ dot.partySeatTotal }} seats</title>
            </circle>
            <circle
              :cx="dot.x"
              :cy="dot.y"
              :r="DOT_RADIUS"
              :fill="dot.colour"
              class="pointer-events-none transition-[opacity,filter,transform] duration-100 [transform-box:fill-box] [transform-origin:center]"
              :class="
                selectedPartyId === dot.partyId
                  ? 'scale-[1.25] opacity-100'
                  : hoveredPartyId === null
                    ? 'opacity-90'
                    : hoveredPartyId === dot.partyId
                      ? 'scale-[1.2] opacity-100'
                      : 'opacity-20'
              "
              :style="hoveredPartyId === dot.partyId || selectedPartyId === dot.partyId ? 'filter: brightness(1.2) saturate(1.2)' : ''"
            />
          </g>
        </g>
      </svg>

      <div class="flex flex-wrap items-center justify-center gap-4">
        <button
          v-for="party of partiesWithSeats"
          :key="party.id"
          type="button"
          class="flex items-center gap-2 rounded px-1.5 py-1 text-left transition hover:bg-zinc-800/70"
          :class="selectedPartyId === party.id ? 'bg-zinc-800/90 text-zinc-100' : ''"
          @click="selectedPartyId = party.id"
        >
          <span :style="{ backgroundColor: party.colour }" class="h-3 w-3 rounded-full"></span>
          <span class="text-xs font-medium">{{ party.shortName }} ({{ party.seats }})</span>
        </button>
      </div>

      <div
        v-if="selectedParty"
        class="w-full rounded border border-zinc-800 bg-zinc-950/80 text-left shadow-xl"
      >
        <div class="flex items-start justify-between gap-3 border-b border-zinc-800 px-3 py-2">
          <div>
            <p class="text-sm font-semibold text-zinc-100">{{ selectedParty.name }}</p>
            <p class="text-xs text-zinc-400">
              {{ selectedParty.seats.toLocaleString() }} seats · {{ activeViewLabel }}
              <span v-if="seatsPerDot > 1"> · {{ seatsPerDot }} seats per dot</span>
            </p>
          </div>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close seat breakdown"
            @click="clearSelection"
          >
            Close
          </button>
        </div>

        <div v-if="selectedDotSeats.length > 1" class="border-b border-zinc-800 px-3 py-2 text-xs text-zinc-300">
          Selected dot:
          {{ selectedDotSeats[0]?.regionName }}
          <span v-if="selectedDotSeats.length > 1">
            to {{ selectedDotSeats[selectedDotSeats.length - 1]?.regionName }}
          </span>
          ({{ selectedDotSeats.length }} seats)
        </div>

        <div class="max-h-64 overflow-y-auto px-3 py-2">
          <div
            v-for="detail of visibleSelectedSeats"
            :key="detail.id"
            class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-zinc-900 py-1.5 last:border-b-0"
          >
            <div class="min-w-0">
              <p class="truncate text-xs font-medium text-zinc-100">
                {{ detail.wardName ?? detail.regionName }}
              </p>
              <p class="truncate text-xs text-zinc-400">
                <span v-if="detail.memberName">{{ detail.memberName }}</span>
                <span v-else>{{ detail.tier }}</span>
              </p>
            </div>
            <div class="text-right text-xs text-zinc-400">
              <p v-if="detail.majority">Maj {{ detail.majority.toLocaleString() }}</p>
              <p v-else-if="detail.voteShare">{{ detail.voteShare.toFixed(1) }}%</p>
              <p v-else-if="selectedTopResult(detail)">{{ selectedTopResult(detail)?.voteShare.toFixed(1) }}%</p>
              <p v-if="detail.nextElection">Next {{ detail.nextElection }}</p>
            </div>
          </div>
          <p v-if="selectedSeats.length > visibleSelectedSeats.length" class="pt-2 text-xs text-zinc-500">
            Showing first {{ visibleSelectedSeats.length.toLocaleString() }} of
            {{ selectedSeats.length.toLocaleString() }} seats.
          </p>
        </div>
      </div>

      <p class="text-xs text-zinc-500">
        Total: {{ totalSeatCount.toLocaleString() }} seats
      </p>
    </div>
  </div>
</template>
