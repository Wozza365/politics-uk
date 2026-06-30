<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Layers, LocateFixed, Minus, Plus, RotateCcw, Target, X } from '@lucide/vue'
import { COUNCIL_LEVELS, councilWardObjectKey, useScenarioStore } from '@/stores/scenario'
import { useUiStore } from '@/stores/ui'
import { useGameStore } from '@/stores/game'
import { HexMapRenderer } from '@/map/HexMapRenderer'
import { SvgMapRenderer, RAISED_EDGE_COLOR, RAISED_EDGE_DEPTH_PX } from '@/map/SvgMapRenderer'
import type { BoundarySet, MapRenderer, RegionState } from '@/map/MapRenderer'
import { MAP_OVERLAY_VISUALS, overlayVisual } from '@/map/visualState'
import { buildCommonsRegionState } from '@/map/regionState/commons'
import {
  buildCouncilRegionState,
  buildCouncilWardRegionState,
  type CouncilBoundaryCollection,
} from '@/map/regionState/councils'
import { buildRegionalRegionState } from '@/map/regionState/regional'
import type { SeatRegionStateContext } from '@/map/regionState/buildSeatRegionState'
import { regionIdsForScope } from '@/sim/targeting'
import Tooltip from '@/components/Tooltip.vue'

const scenario = useScenarioStore()
const ui = useUiStore()
const game = useGameStore()

const container = ref<HTMLElement | null>(null)
const hovered = ref<string | null>(null)
const activeRegion = ref<string | null>(null)
const councilWardFocusRegion = ref<string | null>(null)
const dragging = ref(false)
const snapping = ref(false)
const legendExpanded = ref(true)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)

const activeRendererKey = computed(() =>
  ui.activeView === 'westminster' && ui.westminsterRenderer === 'hex' ? 'hex' : 'svg',
)
let renderer: MapRenderer = createRenderer(activeRendererKey.value)
const councilBoundaryCollectionCache = new Map<string, CouncilBoundaryCollection>()
let councilWardFocusTimer: number | null = null

const isActive = computed(() => activeRegion.value !== null)
const councilRegionsForActiveLevel = computed(() => scenario.councilRegionsForLevel(ui.activeCouncilLevel))
const councilRegionsByGeometryRef = computed(
  () => new Map(councilRegionsForActiveLevel.value.map((region) => [region.geometryRef, region])),
)
const focusedCouncil = computed(() =>
  ui.activeView === 'councils' && councilWardFocusRegion.value
    ? councilRegionsByGeometryRef.value.get(councilWardFocusRegion.value)
    : undefined,
)
const isCouncilWardFocus = computed(() => Boolean(focusedCouncil.value))

const partyColour = (partyId: string) => scenario.party(partyId)?.colours.primary ?? '#9ca3af'

const MIN_ZOOM = 1
const MAX_ZOOM = 6
const BUTTON_ZOOM_STEP = 1.3
const ACTIVE_ZOOM_MIN = 2
const ACTIVE_ZOOM_MAX = MAX_ZOOM
const COUNCIL_FOCUS_ZOOM_MULTIPLIER_MIN = 4.5
const COUNCIL_FOCUS_ZOOM_MULTIPLIER_MAX = 12
const GENERAL_FOCUS_ZOOM_MULTIPLIER_MAX = 10
const LIFT_PX = 3
const SNAP_TRANSFORM_DURATION_MS = 800
const SNAP_DURATION_MS = 1000
const SNAP_BACKGROUND_BLUR_PX = 2
const SNAP_BACKGROUND_BLUR_FADE_MS = 300

const raisedMapFilter = `drop-shadow(0 ${RAISED_EDGE_DEPTH_PX}px 0 ${RAISED_EDGE_COLOR}) drop-shadow(0 8px 10px rgb(0 0 0 / 0.4))`
const tiltDeg = computed(() => (isActive.value ? 38 : 0))
const twistDeg = computed(() => (isActive.value ? -2 : 0))

function createRenderer(key: 'svg' | 'hex'): MapRenderer {
  return key === 'hex' ? new HexMapRenderer() : new SvgMapRenderer()
}

function activeCouncilLevel() {
  return COUNCIL_LEVELS.find((level) => level.id === ui.activeCouncilLevel) ?? COUNCIL_LEVELS[0]
}

function markOverlay(regionState: RegionState, geometryRef: string, key: keyof typeof MAP_OVERLAY_VISUALS) {
  const state = regionState[geometryRef]
  if (!state) return
  const visual = overlayVisual(key)
  state.strokeColor = visual.color
  state.strokeDasharray = visual.strokeDasharray
  state.strokeWidth = Math.max(state.strokeWidth ?? 0, visual.strokeWidth)
}

function applyTargetingOverlays(regionState: RegionState) {
  if (ui.activeView !== 'westminster' || isCouncilWardFocus.value) return
  const tiers = scenario.scenario.tiers

  for (const commitment of game.activeTargetingCommitments) {
    const isPlayer = commitment.partyId === game.selectedPartyId
    if (isPlayer ? !ui.mapOverlays.commitments : !ui.mapOverlays.opponentActivity) continue
    for (const regionId of regionIdsForScope(commitment.targetScope!, tiers, game.contests)) {
      markOverlay(regionState, regionId, isPlayer ? 'commitments' : 'opponentActivity')
    }
  }

  if (ui.mapOverlays.contests) {
    for (const contest of game.contests) {
      if (contest.status === 'pending') markOverlay(regionState, contest.regionId, 'contests')
    }
  }
}

function draw() {
  const councilLevel = activeCouncilLevel()
  const boundarySet: BoundarySet =
    ui.activeView === 'regional'
      ? {
          id: 'regional',
          topology: scenario.regionalBoundaries,
          objectKey: 'regions',
          coordinateSystem: 'lonlat',
        }
      : isCouncilWardFocus.value && focusedCouncil.value
        ? {
            id: `council-wards:${focusedCouncil.value.geometryRef}`,
            topology: scenario.councilWardBoundaries,
            objectKey: councilWardObjectKey(focusedCouncil.value.geometryRef),
            fitTopology: scenario.councilBoundaries,
            fitObjectKey: councilLevel.objectKey,
            backgroundTopology: scenario.councilBoundaries,
            backgroundObjectKey: councilLevel.objectKey,
            backgroundStrokeWidth: 0.1,
          }
        : ui.activeView === 'councils'
          ? {
              id: `councils:${councilLevel.id}`,
              topology: scenario.councilBoundaries,
              objectKey: councilLevel.objectKey,
            }
          : ui.westminsterRenderer === 'hex'
            ? scenario.commonsHexBoundaries
            : {
                id: 'commons',
                topology: scenario.boundaries,
                objectKey: 'regions',
                coordinateSystem: 'lonlat',
              }

  const ctx: SeatRegionStateContext = {
    partyColour,
    partyName: (partyId) => scenario.party(partyId)?.name,
    currentParty: (region, seatIndex) =>
      region.tier === 'commons'
        ? game.currentCommonsSeatHolder(region.id, seatIndex) ?? region.seats[seatIndex]?.party
        : region.seats[seatIndex]?.party,
    hoveredGeometryRef: hovered.value,
    activeGeometryRef: activeRegion.value,
    liftPx: LIFT_PX,
  }
  const regionState =
    ui.activeView === 'regional'
      ? buildRegionalRegionState(scenario.regionalBoundaries, scenario.regionalRegionsByGeometryRef, ctx)
      : isCouncilWardFocus.value && focusedCouncil.value
        ? buildCouncilWardRegionState(scenario.councilWardRegionsForCouncil(focusedCouncil.value.geometryRef), ctx)
        : ui.activeView === 'councils'
          ? buildCouncilRegionState(
              scenario.councilBoundaries,
              councilLevel.objectKey,
              councilRegionsByGeometryRef.value,
              ctx,
              councilBoundaryCollectionCache,
            )
          : buildCommonsRegionState(scenario.commonsRegions, ctx)

  applyTargetingOverlays(regionState)
  renderer.render(boundarySet, regionState)
}

function clampPan() {
  if (!container.value) return
  const maxX = (container.value.clientWidth * (zoom.value - 1)) / 2
  const maxY = (container.value.clientHeight * (zoom.value - 1)) / 2
  panX.value = Math.min(maxX, Math.max(-maxX, panX.value))
  panY.value = Math.min(maxY, Math.max(-maxY, panY.value))
}

function setZoom(next: number) {
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
  if (zoom.value <= MIN_ZOOM) {
    panX.value = 0
    panY.value = 0
  } else {
    clampPan()
  }
}

function zoomIn() {
  if (!isActive.value) setZoom(zoom.value * BUTTON_ZOOM_STEP)
}

function zoomOut() {
  if (!isActive.value) setZoom(zoom.value / BUTTON_ZOOM_STEP)
}

function resetZoom() {
  if (isActive.value) return
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function panBy(deltaX: number, deltaY: number) {
  if (isActive.value || zoom.value <= MIN_ZOOM) return
  panX.value += deltaX
  panY.value += deltaY
  clampPan()
}

function onMapKeydown(event: KeyboardEvent) {
  const tagName = (event.target as HTMLElement | null)?.tagName?.toLowerCase()
  if (tagName === 'button' || tagName === 'input' || tagName === 'select' || tagName === 'textarea') return

  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    zoomIn()
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    zoomOut()
  } else if (event.key === '0') {
    event.preventDefault()
    resetZoom()
  } else if (event.key === 'Escape' && isActive.value) {
    event.preventDefault()
    deactivate()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    panBy(48, 0)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    panBy(-48, 0)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    panBy(0, 48)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    panBy(0, -48)
  }
}

function onWheel(event: WheelEvent) {
  if (isActive.value) return
  setZoom(zoom.value * Math.exp(-event.deltaY * 0.001))
}

let dragStart = { x: 0, y: 0 }

function onMouseDown(event: MouseEvent) {
  if (isActive.value || zoom.value <= MIN_ZOOM) return
  dragging.value = true
  dragStart = { x: event.clientX, y: event.clientY }
}

function onMouseMove(event: MouseEvent) {
  if (!dragging.value) return
  panX.value += event.clientX - dragStart.x
  panY.value += event.clientY - dragStart.y
  dragStart = { x: event.clientX, y: event.clientY }
  clampPan()
}

function onMouseUp() {
  dragging.value = false
}

type TouchMode = 'pan' | 'pinch' | null
let touchMode: TouchMode = null
let touchLast = { x: 0, y: 0 }
let pinchStartDist = 0
let pinchStartZoom = 1

function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function onTouchStart(event: TouchEvent) {
  if (isActive.value) return
  if (event.touches.length === 2) {
    touchMode = 'pinch'
    pinchStartDist = touchDistance(event.touches[0], event.touches[1])
    pinchStartZoom = zoom.value
  } else if (event.touches.length === 1) {
    touchMode = 'pan'
    touchLast = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
}

function onTouchMove(event: TouchEvent) {
  if (isActive.value) return
  if (touchMode === 'pinch' && event.touches.length === 2) {
    const dist = touchDistance(event.touches[0], event.touches[1])
    if (pinchStartDist > 0) setZoom(pinchStartZoom * (dist / pinchStartDist))
  } else if (touchMode === 'pan' && event.touches.length === 1 && zoom.value > MIN_ZOOM) {
    const touch = event.touches[0]
    panX.value += touch.clientX - touchLast.x
    panY.value += touch.clientY - touchLast.y
    touchLast = { x: touch.clientX, y: touch.clientY }
    clampPan()
  }
}

function onTouchEnd(event: TouchEvent) {
  if (event.touches.length === 1) {
    touchMode = 'pan'
    touchLast = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  } else if (event.touches.length === 0) {
    touchMode = null
  }
}

function centerOnRegion(geometryRef: string, zoomMultiplierMin = 1, zoomMultiplierMax = zoomMultiplierMin) {
  if (!container.value) return
  const bounds = renderer.getRegionBounds(geometryRef)
  if (!bounds) return
  const width = container.value.clientWidth
  const height = container.value.clientHeight

  const diagonal = Math.max(Math.hypot(bounds.width, bounds.height), 1)
  const extent = renderer.getRegionSizeExtent()
  let activeZoom = (ACTIVE_ZOOM_MIN + ACTIVE_ZOOM_MAX) / 2
  let relativeSmallness = 0.5
  if (extent && extent.max > extent.min) {
    const logDiagonal = Math.log(diagonal)
    const logMin = Math.log(Math.max(extent.min, 1))
    const logMax = Math.log(Math.max(extent.max, extent.min + 1))
    const t = Math.min(1, Math.max(0, (logDiagonal - logMin) / (logMax - logMin)))
    relativeSmallness = 1 - t
    activeZoom = ACTIVE_ZOOM_MAX - t * (ACTIVE_ZOOM_MAX - ACTIVE_ZOOM_MIN)
  }

  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const zoomMultiplier = zoomMultiplierMin + relativeSmallness * (zoomMultiplierMax - zoomMultiplierMin)
  const targetZoom = activeZoom * zoomMultiplier
  zoom.value = targetZoom
  panX.value = -(centerX - width / 2) * targetZoom
  panY.value = -(centerY - height / 2) * targetZoom
}

function clearCouncilWardFocusTimer() {
  if (councilWardFocusTimer == null) return
  window.clearTimeout(councilWardFocusTimer)
  councilWardFocusTimer = null
}

function snap(run: () => void) {
  snapping.value = true
  const useBackgroundBlur = ui.activeView !== 'councils'
  renderer.setBackgroundBlur(useBackgroundBlur ? SNAP_BACKGROUND_BLUR_PX : null)
  run()
  if (useBackgroundBlur) {
    setTimeout(() => renderer.setBackgroundBlur(null), SNAP_DURATION_MS - SNAP_BACKGROUND_BLUR_FADE_MS)
  }
  setTimeout(() => {
    snapping.value = false
  }, SNAP_DURATION_MS)
}

function activate(geometryRef: string) {
  snap(() => {
    if (ui.activeView === 'councils') {
      clearCouncilWardFocusTimer()
      councilWardFocusRegion.value = null
      centerOnRegion(geometryRef, COUNCIL_FOCUS_ZOOM_MULTIPLIER_MIN, COUNCIL_FOCUS_ZOOM_MULTIPLIER_MAX)
      activeRegion.value = geometryRef
      councilWardFocusTimer = window.setTimeout(() => {
        councilWardFocusTimer = null
        if (ui.activeView === 'councils' && activeRegion.value === geometryRef) {
          councilWardFocusRegion.value = geometryRef
        }
      }, SNAP_TRANSFORM_DURATION_MS)
    } else {
      activeRegion.value = geometryRef
      centerOnRegion(geometryRef, COUNCIL_FOCUS_ZOOM_MULTIPLIER_MIN, GENERAL_FOCUS_ZOOM_MULTIPLIER_MAX)
    }
  })
}

function deactivate() {
  snap(() => {
    clearCouncilWardFocusTimer()
    councilWardFocusRegion.value = null
    activeRegion.value = null
    zoom.value = 1
    panX.value = 0
    panY.value = 0
  })
}

function onRegionClick(geometryRef: string) {
  if (isCouncilWardFocus.value) return
  if (activeRegion.value === geometryRef) {
    deactivate()
  } else {
    activate(geometryRef)
  }
}

function onWindowClick(event: MouseEvent) {
  const tagName = (event.target as Element).tagName?.toLowerCase()
  if (tagName === 'path' || tagName === 'polygon') return
  if (activeRegion.value) deactivate()
}

function bindRendererEvents() {
  renderer.setEvents({
    onRegionHover: (geometryRef) => {
      hovered.value = geometryRef
    },
    onRegionClick,
  })
}

function remountRenderer() {
  if (!container.value) return
  renderer.unmount()
  renderer = createRenderer(activeRendererKey.value)
  renderer.mount(container.value)
  bindRendererEvents()
  draw()
}

function resetMapFocus() {
  clearCouncilWardFocusTimer()
  hovered.value = null
  activeRegion.value = null
  councilWardFocusRegion.value = null
  resetZoom()
}

onMounted(() => {
  if (!container.value) return
  renderer.mount(container.value)
  bindRendererEvents()
  draw()
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('click', onWindowClick)
})

watch(hovered, draw)
watch(activeRegion, draw)
watch(councilWardFocusRegion, draw)
watch(activeRendererKey, () => {
  resetMapFocus()
  remountRenderer()
})
watch(() => ui.activeView, () => {
  resetMapFocus()
  draw()
})
watch(() => ui.activeCouncilLevel, () => {
  resetMapFocus()
  draw()
})
watch(() => ui.mapOverlays, draw, { deep: true })
watch(() => game.activeTargetingCommitments, draw, { deep: true })
watch(() => game.contests, draw, { deep: true })
watch(() => game.electionOutcomes, draw, { deep: true })
watch(() => ui.mapFocusRequest, async (request) => {
  if (!request) return
  ui.setActiveView(request.view)
  if (request.view === 'councils' && request.councilLevel) ui.setActiveCouncilLevel(request.councilLevel)
  await nextTick()
  activate(request.geometryRef)
  ui.clearMapFocus()
})

onUnmounted(() => {
  clearCouncilWardFocusTimer()
  renderer.unmount()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('click', onWindowClick)
})

function regionForGeometryRef(geometryRef: string | null) {
  if (!geometryRef) return undefined
  return ui.activeView === 'regional'
    ? scenario.regionalRegionsByGeometryRef.get(geometryRef)
    : isCouncilWardFocus.value && focusedCouncil.value
      ? scenario.councilWardRegionsForCouncil(focusedCouncil.value.geometryRef).find((r) => r.geometryRef === geometryRef)
      : ui.activeView === 'councils'
        ? councilRegionsByGeometryRef.value.get(geometryRef)
        : scenario.commonsRegions.find((r) => r.geometryRef === geometryRef)
}

const displayGeometryRef = computed(() => activeRegion.value ?? hovered.value)
const displayRegion = computed(() => regionForGeometryRef(displayGeometryRef.value))
const displayIsActive = computed(() => Boolean(activeRegion.value && displayRegion.value))
const displaySeat = computed(() => displayRegion.value?.seats[0])
const displaySeatParty = computed(() => {
  const region = displayRegion.value
  if (!region) return undefined
  return region.tier === 'commons' ? game.currentCommonsSeatHolder(region.id) ?? displaySeat.value?.party : displaySeat.value?.party
})
const displayCouncilControl = computed(() => (ui.activeView === 'councils' ? displayRegion.value?.control : undefined))
const displayDemographics = computed(() => {
  if (ui.activeView !== 'westminster') return undefined
  const region = displayRegion.value
  return region ? scenario.demographicsByRegion.get(region.geometryRef) : undefined
})
const topResults = computed(() => displaySeat.value?.results?.slice(0, 3) ?? [])
const turnoutPct = computed(() => {
  if (!displaySeat.value?.turnout || !displaySeat.value.electorate) return undefined
  return Math.round((displaySeat.value.turnout / displaySeat.value.electorate) * 100)
})
const mapStatusLabel = computed(() => {
  const rendererLabel = activeRendererKey.value === 'hex' ? 'Hex' : 'Geographic'
  return `${Math.round(zoom.value * 100)}% / ${rendererLabel}`
})
const activeRegionBadges = computed(() => {
  const region = displayRegion.value
  if (!region || ui.activeView !== 'westminster') return []
  const badges: Array<{ key: keyof typeof MAP_OVERLAY_VISUALS; label: string }> = []
  const tiers = scenario.scenario.tiers
  const hasPlayerCommitment = game.activeTargetingCommitments.some(
    (commitment) =>
      commitment.partyId === game.selectedPartyId &&
      commitment.targetScope &&
      regionIdsForScope(commitment.targetScope, tiers, game.contests).includes(region.id),
  )
  const hasOpponentActivity = game.activeTargetingCommitments.some(
    (commitment) =>
      commitment.partyId !== game.selectedPartyId &&
      commitment.targetScope &&
      regionIdsForScope(commitment.targetScope, tiers, game.contests).includes(region.id),
  )
  const hasContest = game.contests.some((contest) => contest.status === 'pending' && contest.regionId === region.id)

  if (hasPlayerCommitment) badges.push({ key: 'commitments', label: MAP_OVERLAY_VISUALS.commitments.label })
  if (hasOpponentActivity) badges.push({ key: 'opponentActivity', label: MAP_OVERLAY_VISUALS.opponentActivity.label })
  if (hasContest) badges.push({ key: 'contests', label: MAP_OVERLAY_VISUALS.contests.label })
  return badges
})
const overlayLegendEntries = computed(() =>
  Object.entries(MAP_OVERLAY_VISUALS).map(([key, visual]) => ({
    key: key as keyof typeof MAP_OVERLAY_VISUALS,
    ...visual,
  })),
)

function openTargetingPanel() {
  if (!ui.targetingPanelOpen) ui.toggleTargetingPanel()
}
</script>

<template>
  <div
    class="puk-map-room relative h-full w-full select-none overflow-hidden"
    tabindex="0"
    role="region"
    aria-label="Interactive political map"
    @keydown="onMapKeydown"
  >
    <div class="puk-map-frame absolute inset-0">
      <div
        class="puk-map-stage h-full w-full origin-center"
        :style="{
          transform: `perspective(1400px) rotateX(${tiltDeg}deg) rotateZ(${twistDeg}deg)`,
          transition: `transform ${SNAP_TRANSFORM_DURATION_MS}ms ease-in-out`,
          filter: snapping || ui.activeView === 'councils' ? 'none' : raisedMapFilter,
        }"
      >
        <div
          ref="container"
          class="relative h-full w-full overflow-hidden bg-transparent"
          :style="{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center',
            transition: snapping ? `transform ${SNAP_TRANSFORM_DURATION_MS}ms ease-in-out` : 'none',
            cursor: isActive ? 'default' : zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
          }"
          @wheel.prevent="onWheel"
          @mousedown="onMouseDown"
          @touchstart="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        />
      </div>
    </div>

    <section
      v-if="displayRegion"
      class="puk-map-detail absolute left-3 top-3 w-[min(24rem,calc(100%-6rem))]"
      :class="{ 'puk-map-detail--active': displayIsActive }"
      aria-live="polite"
      @click.stop
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="hud-panel-kicker">{{ displayIsActive ? 'Selected region' : 'Map detail' }}</p>
          <h2 class="hud-panel-title mt-1 truncate">{{ displayRegion.name }}</h2>
          <p v-if="displayCouncilControl" class="hud-panel-subtitle">
            {{ displayCouncilControl.label }}
            <span v-if="displayCouncilControl.party">
              / {{ scenario.party(displayCouncilControl.party)?.shortName ?? displayCouncilControl.party }}
            </span>
          </p>
          <p v-else class="hud-panel-subtitle">
            {{ scenario.party(displaySeatParty ?? '')?.name ?? 'Unheld' }}
            <span v-if="displaySeat?.memberName"> / {{ displaySeat.memberName }}</span>
          </p>
        </div>

        <button
          v-if="displayIsActive"
          type="button"
          class="puk-map-mini-button"
          aria-label="Clear selected region"
          @click.stop="deactivate"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div class="hud-stat-tile p-2">
          <p class="hud-stat-label">Share</p>
          <p class="hud-stat-value mt-1">{{ displaySeat?.voteShare?.toFixed(1) ?? 'n/a' }}%</p>
        </div>
        <div class="hud-stat-tile p-2">
          <p class="hud-stat-label">Majority</p>
          <p class="hud-stat-value mt-1">{{ displaySeat?.majority?.toLocaleString() ?? 'n/a' }}</p>
        </div>
        <div class="hud-stat-tile p-2">
          <p class="hud-stat-label">Turnout</p>
          <p class="hud-stat-value mt-1">{{ turnoutPct ?? 'n/a' }}%</p>
        </div>
      </div>

      <div v-if="topResults.length" class="mt-3 space-y-1.5">
        <div
          v-for="result in topResults"
          :key="result.candidateName ?? result.party"
          class="grid grid-cols-[2.75rem_1fr_minmax(2rem,auto)] items-center gap-2 text-xs"
        >
          <span class="truncate text-puk-text-muted">{{ scenario.party(result.party)?.shortName ?? result.party }}</span>
          <span class="h-2 overflow-hidden rounded-sm bg-puk-border-subtle">
            <span
              class="block h-full"
              :style="{ width: `${Math.max(result.voteShare, 2)}%`, backgroundColor: partyColour(result.party) }"
            />
          </span>
          <span class="text-right tabular-nums text-puk-text">{{ result.voteShare.toFixed(1) }}%</span>
        </div>
      </div>

      <div v-if="displayDemographics" class="mt-3 border-t border-puk-border-subtle pt-3 text-xs text-puk-text-muted">
        <div class="grid grid-cols-2 gap-x-3 gap-y-1">
          <span v-if="displayDemographics.populationDensityPerKm2">
            Density {{ Math.round(displayDemographics.populationDensityPerKm2).toLocaleString() }}/km2
          </span>
          <span v-if="displayDemographics.employmentRatePct">Employment {{ displayDemographics.employmentRatePct }}%</span>
          <span v-if="displayDemographics.unemploymentRatePct">Unemployment {{ displayDemographics.unemploymentRatePct }}%</span>
          <span v-if="displayDemographics.medianAge">Median age {{ displayDemographics.medianAge }}</span>
        </div>
        <p v-if="displayDemographics.source === 'estimated' || displayDemographics.notes" class="mt-2 text-[0.7rem] italic">
          {{ displayDemographics.source === 'estimated' ? 'Estimated figures' : displayDemographics.notes }}
        </p>
      </div>

      <div v-if="activeRegionBadges.length || displayIsActive" class="mt-3 flex flex-wrap items-center gap-2">
        <span
          v-for="badge in activeRegionBadges"
          :key="badge.key"
          class="puk-map-badge"
          :style="{ '--map-overlay-color': MAP_OVERLAY_VISUALS[badge.key].color }"
        >
          <span
            class="puk-map-badge__rail"
            :style="{ borderStyle: MAP_OVERLAY_VISUALS[badge.key].strokeDasharray ? 'dashed' : 'solid' }"
          />
          {{ badge.label }}
        </span>
        <button
          v-if="displayIsActive && ui.activeView === 'westminster'"
          type="button"
          class="hud-action-button hud-action-button--primary ml-auto"
          @click.stop="openTargetingPanel"
        >
          <Target class="h-4 w-4" aria-hidden="true" />
          Target seat
        </button>
      </div>
    </section>

    <section
      v-if="ui.activeView === 'westminster' && !isCouncilWardFocus"
      class="puk-map-legend absolute bottom-3 left-3"
      :class="{ 'puk-map-legend--expanded': legendExpanded }"
      aria-label="Map overlay legend"
      @click.stop
    >
      <button
        type="button"
        class="puk-map-legend__toggle"
        :aria-expanded="legendExpanded"
        @click="legendExpanded = !legendExpanded"
      >
        <Layers class="h-4 w-4" aria-hidden="true" />
        <span>Legend</span>
      </button>

      <div v-if="legendExpanded" class="puk-map-legend__body">
        <button
          v-for="entry in overlayLegendEntries"
          :key="entry.key"
          type="button"
          class="puk-map-legend__row"
          :class="{ 'puk-map-legend__row--muted': !ui.mapOverlays[entry.key] }"
          @click="ui.toggleMapOverlay(entry.key)"
        >
          <span
            class="puk-map-legend__sample"
            :style="{
              '--map-overlay-color': entry.color,
              borderStyle: entry.strokeDasharray ? 'dashed' : 'solid',
            }"
          />
          <span class="min-w-0">
            <span class="block truncate">{{ entry.label }}</span>
            <span class="block truncate text-[0.68rem] text-puk-text-disabled">{{ entry.cue }}</span>
          </span>
        </button>
        <div class="puk-map-legend__row pointer-events-none">
          <span class="puk-map-legend__hatch" />
          <span class="min-w-0">
            <span class="block truncate">Disabled regions</span>
            <span class="block truncate text-[0.68rem] text-puk-text-disabled">hatched fill</span>
          </span>
        </div>
      </div>
    </section>

    <button
      v-if="isCouncilWardFocus"
      type="button"
      class="puk-map-back-button absolute bottom-3 left-1/2 max-w-[min(28rem,calc(100vw-6rem))] -translate-x-1/2"
      @click.stop="deactivate"
    >
      Back to {{ activeCouncilLevel().label }} councils
    </button>

    <div class="puk-map-controls absolute bottom-3 right-3" @click.stop>
      <div class="puk-map-status">{{ mapStatusLabel }}</div>
      <Tooltip text="Zoom in">
        <button
          type="button"
          aria-label="Zoom in"
          class="puk-map-control-button"
          :disabled="isActive || zoom >= MAX_ZOOM"
          @click="zoomIn"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip text="Zoom out">
        <button
          type="button"
          aria-label="Zoom out"
          class="puk-map-control-button"
          :disabled="isActive || zoom <= MIN_ZOOM"
          @click="zoomOut"
        >
          <Minus class="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip text="Reset zoom">
        <button
          type="button"
          aria-label="Reset zoom"
          class="puk-map-control-button"
          :disabled="isActive || (zoom === 1 && panX === 0 && panY === 0)"
          @click="resetZoom"
        >
          <RotateCcw class="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip text="Centre selected region">
        <button
          type="button"
          aria-label="Centre selected region"
          class="puk-map-control-button"
          :disabled="!activeRegion"
          @click="activeRegion && centerOnRegion(activeRegion)"
        >
          <LocateFixed class="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  </div>
</template>
