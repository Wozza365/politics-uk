<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronsUpDown, Grid2X2, Landmark, X } from '@lucide/vue'
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
  const party = region.tier === 'commons' ? gameStore.currentCommonsSeatHolder(region.id, seatIndex) ?? seat.party : seat.party
  return {
    id: `${region.tier}:${region.id}:${seatIndex}`,
    party: groupedPartyId(party),
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
    if (NI_PARTY_IDS.includes(party.id) || party.id === SPEAKER_PARTY_ID || party.id === INDEPENDENT_PARTY_ID) continue
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
    uiStore.openMenu()
    gameStore.pauseClock('menu')
  } else {
    clearSelection()
    uiStore.closeMenu()
    gameStore.resumeClockIfClear()
  }
}

const largestParty = computed(() => {
  const list = [...partiesWithSeats.value].sort((a, b) => b.seats - a.seats)
  return list[0] ?? null
})

const partySummary = computed(() =>
  [...partiesWithSeats.value]
    .sort((a, b) => b.seats - a.seats)
    .slice(0, 5),
)

function partyInitials(name: string, shortName: string) {
  const compact = shortName.replace(/[^A-Za-z0-9]/g, '')
  if (compact.length <= 4) return compact
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0])
    .join('')
}
</script>

<template>
  <div class="flex w-full flex-col">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-puk-surface-raised/70"
      :aria-expanded="isExpanded"
      aria-label="Toggle party makeup panel"
      @click="toggleExpanded"
    >
      <span class="flex min-w-0 items-center gap-2">
        <Landmark class="h-4 w-4 text-puk-premium-accent" aria-hidden="true" />
        <span class="truncate text-sm font-semibold tracking-wide text-puk-text">Party makeup</span>
      </span>
      <span class="flex items-center gap-3 text-xs text-puk-text-muted">
        <span v-if="largestParty">
          Largest: <span class="font-semibold text-puk-text">{{ largestParty.shortName }}</span>
          ({{ largestParty.seats }})
        </span>
        <span>{{ totalSeatCount }} seats</span>
        <ChevronsUpDown class="h-4 w-4 text-puk-text" aria-hidden="true" />
      </span>
    </button>

    <div v-if="isExpanded" class="hemicycle-shell relative flex flex-col items-center justify-center gap-4 px-4 pb-4 pt-4">
      <button
        type="button"
        role="switch"
        :aria-checked="isHemicycleMode"
        class="absolute left-3 top-3 z-10 inline-flex h-9 items-center gap-2 rounded-md border border-puk-border bg-puk-surface-raised/90 px-2 text-xs font-bold text-puk-text-muted transition hover:text-puk-text"
        :aria-label="isHemicycleMode ? 'Switch to house view' : 'Switch to hemicycle view'"
        title="Switch view"
        @click="toggleViewMode"
      >
        <component :is="isHemicycleMode ? Grid2X2 : Landmark" class="h-4 w-4" aria-hidden="true" />
        {{ isHemicycleMode ? 'House' : 'Arc' }}
      </button>

      <div class="grid w-full grid-cols-3 gap-2 self-stretch text-xs md:grid-cols-5">
        <div v-for="party in partySummary" :key="party.id" class="hud-stat-tile p-2">
          <p class="hud-stat-label truncate">{{ party.shortName }}</p>
          <p class="hud-stat-value mt-1 text-base font-semibold">{{ party.seats.toLocaleString() }}</p>
        </div>
      </div>

      <svg
        :width="VIEWPORT_WIDTH"
        :height="VIEWPORT_HEIGHT"
        viewBox="0 0 500 200"
        class="hemicycle-svg"
        role="img"
        :aria-label="`${activeViewLabel} party makeup, ${totalSeatCount.toLocaleString()} seats, ${seatsPerDot} seats per dot`"
      >
        <path
          v-if="isHemicycleMode"
          d="M 24 178 A 226 176 0 0 1 476 178"
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.12"
          stroke-width="2"
        />
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
              <title>{{ dot.partyName }} / {{ dot.partySeatTotal }} seats</title>
            </circle>
            <circle
              :cx="dot.x"
              :cy="dot.y"
              :r="DOT_RADIUS"
              :fill="dot.colour"
              class="hemicycle-dot pointer-events-none transition-[opacity,filter,transform] duration-100 [transform-box:fill-box] [transform-origin:center]"
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

      <p class="self-start text-xs text-puk-text-muted">
        {{ seatsPerDot }} seat{{ seatsPerDot === 1 ? '' : 's' }} per dot. Parties are labelled for non-colour reading.
      </p>

      <div class="grid w-full grid-cols-2 gap-2 md:grid-cols-4">
        <button
          v-for="party of partiesWithSeats"
          :key="party.id"
          type="button"
          class="hemicycle-party-chip"
          :class="{ 'hemicycle-party-chip--selected': selectedPartyId === party.id }"
          :style="{ '--party-colour': party.colour }"
          @click="selectedPartyId = party.id"
        >
          <span class="hemicycle-party-mark">{{ partyInitials(party.name, party.shortName) }}</span>
          <span class="min-w-0 truncate text-xs font-semibold">{{ party.shortName }}</span>
          <span class="tabular-nums text-xs">{{ party.seats }}</span>
        </button>
      </div>

      <div v-if="selectedParty" class="hud-record w-full text-left shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b border-puk-border-subtle px-3 py-2">
          <div>
            <p class="text-sm font-semibold text-puk-text">{{ selectedParty.name }}</p>
            <p class="text-xs text-puk-text-muted">
              {{ selectedParty.seats.toLocaleString() }} seats / {{ activeViewLabel }}
              <span v-if="seatsPerDot > 1"> / {{ seatsPerDot }} seats per dot</span>
            </p>
          </div>
          <button
            type="button"
            class="hud-icon-button hud-icon-button--sm"
            aria-label="Close seat breakdown"
            @click="clearSelection"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div v-if="selectedDotSeats.length > 1" class="border-b border-puk-border-subtle px-3 py-2 text-xs text-puk-text-muted">
          Selected dot:
          {{ selectedDotSeats[0]?.regionName }}
          <span v-if="selectedDotSeats.length > 1">
            to {{ selectedDotSeats[selectedDotSeats.length - 1]?.regionName }}
          </span>
          ({{ selectedDotSeats.length }} seats)
        </div>

        <div class="max-h-64 overflow-y-auto px-3 py-2">
          <div v-for="detail of visibleSelectedSeats" :key="detail.id" class="hemicycle-summary-row">
            <div class="min-w-0">
              <p class="truncate text-xs font-medium text-puk-text">
                {{ detail.wardName ?? detail.regionName }}
              </p>
              <p class="truncate text-xs text-puk-text-muted">
                <span v-if="detail.memberName">{{ detail.memberName }}</span>
                <span v-else>{{ detail.tier }}</span>
              </p>
            </div>
            <div class="text-right text-xs text-puk-text-muted">
              <p v-if="detail.majority">Maj {{ detail.majority.toLocaleString() }}</p>
              <p v-else-if="detail.voteShare">{{ detail.voteShare.toFixed(1) }}%</p>
              <p v-else-if="selectedTopResult(detail)">{{ selectedTopResult(detail)?.voteShare.toFixed(1) }}%</p>
              <p v-if="detail.nextElection">Next {{ detail.nextElection }}</p>
            </div>
          </div>
          <p v-if="selectedSeats.length > visibleSelectedSeats.length" class="pt-2 text-xs text-puk-text-disabled">
            Showing first {{ visibleSelectedSeats.length.toLocaleString() }} of
            {{ selectedSeats.length.toLocaleString() }} seats.
          </p>
        </div>
      </div>

      <p class="text-xs text-puk-text-disabled">Total: {{ totalSeatCount.toLocaleString() }} seats</p>
    </div>
  </div>
</template>
