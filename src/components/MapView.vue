<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import { useScenarioStore } from '@/stores/scenario'
import { useUiStore } from '@/stores/ui'
import { SvgMapRenderer, RAISED_EDGE_DEPTH_PX, RAISED_EDGE_COLOR } from '@/map/SvgMapRenderer'
import type { BoundarySet, RegionState } from '@/map/MapRenderer'

const scenario = useScenarioStore()
const ui = useUiStore()

const partyColour = (partyId: string) => scenario.party(partyId)?.colours.primary ?? '#9ca3af'

const container = ref<HTMLElement | null>(null)
const hovered = ref<string | null>(null)
const renderer = new SvgMapRenderer()

// --- Active (clicked) constituency -------------------------------------
const activeRegion = ref<string | null>(null)
const isActive = computed(() => activeRegion.value !== null)
const LIFT_PX = 3

function buildCommonsRegionState(): RegionState {
  const state: RegionState = {}
  for (const region of scenario.commonsRegions) {
    const holder = region.seats[0]
    const isActiveRegion = activeRegion.value === region.geometryRef
    state[region.geometryRef] = {
      fill: holder ? partyColour(holder.party) : '#9ca3af',
      selected: hovered.value === region.geometryRef,
      opacity: isActive.value && !isActiveRegion ? 0.5 : undefined,
      liftPx: isActiveRegion ? LIFT_PX : undefined,
      tooltip: {
        name: region.name,
        party: holder ? scenario.party(holder.party)?.name : undefined,
        member: holder?.memberName,
      },
    }
  }
  return state
}

// Regional view (P2.1): every geometryRef on boundaries.regional.json is
// either a real constituency from one of the four bodies (Holyrood/Senedd/
// NI Assembly/London Assembly) or England-outside-London filler with no
// matching region — filler renders disabled (greyed out, non-interactive)
// per the design decision recorded in docs/PHASE_2_PLAN.md's P2.1.
function buildRegionalRegionState(): RegionState {
  const state: RegionState = {}
  const collection = feature(
    scenario.regionalBoundaries,
    scenario.regionalBoundaries.objects.regions,
  ) as unknown as FeatureCollection<Geometry, { geometryRef: string }>
  for (const feat of collection.features) {
    const geometryRef = feat.properties.geometryRef
    const region = scenario.regionalRegionsByGeometryRef.get(geometryRef)
    if (!region) {
      state[geometryRef] = { fill: '#d4d4d8', disabled: true }
      continue
    }
    const holder = region.seats[0]
    const isActiveRegion = activeRegion.value === geometryRef
    state[geometryRef] = {
      fill: holder ? partyColour(holder.party) : '#9ca3af',
      selected: hovered.value === geometryRef,
      opacity: isActive.value && !isActiveRegion ? 0.5 : undefined,
      liftPx: isActiveRegion ? LIFT_PX : undefined,
      tooltip: {
        name: region.name,
        party: holder ? scenario.party(holder.party)?.name : undefined,
        member: holder?.memberName,
      },
    }
  }
  return state
}

function draw() {
  const boundarySet: BoundarySet =
    ui.activeView === 'regional'
      ? { id: 'regional', topology: scenario.regionalBoundaries, objectKey: 'regions' }
      : { id: 'commons', topology: scenario.boundaries, objectKey: 'regions' }
  const regionState = ui.activeView === 'regional' ? buildRegionalRegionState() : buildCommonsRegionState()
  renderer.render(boundarySet, regionState)
}

// --- Independent zoom/pan ---------------------------------------------
// Implemented as a CSS transform on the renderer's mount point rather than
// inside SvgMapRenderer, so the same controls work regardless of which
// MapRenderer backend is mounted (spec's renderer-abstraction goal).
const MIN_ZOOM = 1
const MAX_ZOOM = 6
const BUTTON_ZOOM_STEP = 1.3
// Activating a constituency picks a zoom level by ranking its bounding-box
// diagonal against every other region's, then placing it along this range —
// closest for the smallest region in the dataset, furthest for the largest.
// Ranking against the dataset (rather than fitting each region to a fixed
// on-screen target independently) is what guarantees two different-sized
// constituencies actually land on two different zoom levels: a fixed-target
// fit saturates at the min/max clamp for most regions, since UK constituency
// size is heavily skewed (a few huge rural seats, hundreds of similarly
// small urban ones).
const ACTIVE_ZOOM_MIN = 2
const ACTIVE_ZOOM_MAX = MAX_ZOOM

const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)

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
  if (isActive.value) return
  setZoom(zoom.value * BUTTON_ZOOM_STEP)
}

function zoomOut() {
  if (isActive.value) return
  setZoom(zoom.value / BUTTON_ZOOM_STEP)
}

function resetZoom() {
  if (isActive.value) return
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function onWheel(event: WheelEvent) {
  if (isActive.value) return
  const factor = Math.exp(-event.deltaY * 0.001)
  setZoom(zoom.value * factor)
}

// Mouse drag-to-pan (only meaningful once zoomed in).
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

// Touch: one finger pans, two fingers pinch-zoom.
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

// --- Click a constituency to activate it --------------------------------
// Activating zooms in, centred on that constituency, to a level proportional
// to its size (see ACTIVE_ZOOM_MIN/MAX above), steepens the map's tilt (spec:
// default is near-flat; the active view is the more dramatic angle the whole
// map used to sit at permanently), raises that one region above the rest,
// and dims everything else. Manual zoom/pan is disabled while active (gated
// above); clicking the active region again, a different region, or empty
// space all resolve it below.
function centerOnRegion(geometryRef: string) {
  if (!container.value) return
  const bounds = renderer.getRegionBounds(geometryRef)
  if (!bounds) return
  const width = container.value.clientWidth
  const height = container.value.clientHeight

  const diagonal = Math.max(Math.hypot(bounds.width, bounds.height), 1)
  const extent = renderer.getRegionSizeExtent()
  let activeZoom = (ACTIVE_ZOOM_MIN + ACTIVE_ZOOM_MAX) / 2
  if (extent && extent.max > extent.min) {
    // Logarithmic, not linear: a handful of very large rural seats would
    // otherwise stretch the range so far that all the small/medium ones
    // bunch up near one end and look identical.
    const logDiagonal = Math.log(diagonal)
    const logMin = Math.log(Math.max(extent.min, 1))
    const logMax = Math.log(Math.max(extent.max, extent.min + 1))
    const t = (logDiagonal - logMin) / (logMax - logMin)
    activeZoom = ACTIVE_ZOOM_MAX - t * (ACTIVE_ZOOM_MAX - ACTIVE_ZOOM_MIN)
  }

  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  zoom.value = activeZoom
  panX.value = -(centerX - width / 2) * activeZoom
  panY.value = -(centerY - height / 2) * activeZoom
}

// Only the activate/deactivate snap should animate the pan/zoom transform —
// manual drag/wheel/pinch update the same transform far more often and need
// to track the input with zero added delay, so the transition is toggled on
// just for the duration of a snap rather than left on permanently.
const snapping = ref(false)
// The transform (tilt + zoom) itself moves faster than the snap's overall
// duration — the background blur (below) is deliberately held for the
// extra 200ms after the move finishes, since that's where the pixelation
// we can't fully eliminate is most visible (right as the transform settles).
const SNAP_TRANSFORM_DURATION_MS = 800
const SNAP_DURATION_MS = 1000
// Cover-up, not a real fix: blurring the background masks the soft edges and
// transient colour shifts the snap's combined tilt+zoom transform causes on
// the ~650-path background while it's actively animating. Faded in/out
// (via the svg's own `filter` transition) rather than toggled abruptly, so
// it peaks partway into the snap and is gone again by the time it settles —
// not a flat blur held for the full duration.
const SNAP_BACKGROUND_BLUR_PX = 2
const SNAP_BACKGROUND_BLUR_FADE_MS = 300

function snap(run: () => void) {
  snapping.value = true
  renderer.setBackgroundBlur(SNAP_BACKGROUND_BLUR_PX)
  run()
  setTimeout(() => {
    renderer.setBackgroundBlur(null)
  }, SNAP_DURATION_MS - SNAP_BACKGROUND_BLUR_FADE_MS)
  setTimeout(() => {
    snapping.value = false
  }, SNAP_DURATION_MS)
}

function activate(geometryRef: string) {
  snap(() => {
    activeRegion.value = geometryRef
    centerOnRegion(geometryRef)
  })
}

function deactivate() {
  snap(() => {
    activeRegion.value = null
    zoom.value = 1
    panX.value = 0
    panY.value = 0
  })
}

function onRegionClick(geometryRef: string) {
  if (activeRegion.value === geometryRef) {
    deactivate()
  } else {
    activate(geometryRef)
  }
}

function onWindowClick(event: MouseEvent) {
  // A click on a constituency <path> is handled by onRegionClick (above) via
  // the renderer's own event wiring — this only needs to catch "elsewhere":
  // empty map background, or anywhere else on the page entirely.
  const target = event.target as Element
  if (target.tagName?.toLowerCase() === 'path') return
  if (activeRegion.value) deactivate()
}

onMounted(() => {
  if (!container.value) return
  renderer.mount(container.value)
  renderer.setEvents({
    onRegionHover: (geometryRef) => {
      hovered.value = geometryRef
    },
    onRegionClick,
  })
  draw()
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('click', onWindowClick)
})

watch(hovered, draw)
watch(activeRegion, draw)
watch(() => ui.activeView, draw)
onUnmounted(() => {
  renderer.unmount()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('click', onWindowClick)
})

const hoveredRegion = () =>
  ui.activeView === 'regional'
    ? scenario.regionalRegionsByGeometryRef.get(hovered.value ?? '')
    : scenario.commonsRegions.find((r) => r.geometryRef === hovered.value)

const hoveredSeat = computed(() => hoveredRegion()?.seats[0])
const hoveredDemographics = computed(() => {
  const region = hoveredRegion()
  return region ? scenario.demographicsByRegion.get(region.geometryRef) : undefined
})

// --- "Raised" 3D depth -------------------------------------------------
// The renderer is flat SVG, so depth is faked with drop-shadow(), which
// (unlike box-shadow) follows the rendered content's own alpha silhouette
// rather than its rectangular box — a single small offset reads as a thin
// raised edge around the coastline outline. Stacking many such layers for
// a smoother gradient was tried and discarded: each drop-shadow is a full
// extra rasterization pass over the whole (complex, many-path) SVG, and a
// 16-layer stack made panning/zooming visibly laggy. One layer is cheap.
const raisedMapFilter = `drop-shadow(0 ${RAISED_EDGE_DEPTH_PX}px 0 ${RAISED_EDGE_COLOR}) drop-shadow(0 8px 10px rgb(0 0 0 / 0.4))`

// --- Tilt: flat by default, steeper while a region is active -----------
const DEFAULT_TILT_DEG = 0
const ACTIVE_TILT_DEG = 38
const DEFAULT_TWIST_DEG = 0
const ACTIVE_TWIST_DEG = -2
const tiltDeg = computed(() => (isActive.value ? ACTIVE_TILT_DEG : DEFAULT_TILT_DEG))
const twistDeg = computed(() => (isActive.value ? ACTIVE_TWIST_DEG : DEFAULT_TWIST_DEG))
</script>

<template>
  <div class="relative h-full w-full select-none">
    <div
      class="h-full w-full origin-center"
      :style="{
        transform: `perspective(1400px) rotateX(${tiltDeg}deg) rotateZ(${twistDeg}deg)`,
        transition: `transform ${SNAP_TRANSFORM_DURATION_MS}ms ease-in-out`,
        // A `filter` on an ancestor of an animating `transform` forces the
        // browser to rasterize this subtree and scale that bitmap for the
        // duration of the transition rather than re-rendering the SVG's
        // vector paths each frame, which is what made the map look blurry
        // while snapping to/from a constituency. Dropping the filter only
        // for the transition window (it's purely decorative) keeps the snap
        // crisp; it reappears once the transform has settled.
        filter: snapping ? 'none' : raisedMapFilter,
      }"
    >
      <div
        ref="container"
        class="relative h-full w-full overflow-hidden rounded-lg bg-transparent"
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

    <div
      v-if="hoveredRegion()"
      class="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-zinc-900/90 px-3 py-2 text-sm text-white shadow-lg"
    >
      <p class="font-semibold">{{ hoveredRegion()?.name }}</p>
      <p class="text-zinc-300">
        {{ scenario.party(hoveredSeat?.party ?? '')?.name }} —
        {{ hoveredSeat?.memberName }}
      </p>

      <div v-if="hoveredSeat?.results?.length" class="mt-1.5 space-y-0.5">
        <div
          v-for="result in hoveredSeat.results"
          :key="result.candidateName ?? result.party"
          class="flex items-center gap-1.5 text-xs"
        >
          <span class="w-9 shrink-0 text-right text-zinc-400">{{ result.voteShare.toFixed(1) }}%</span>
          <span
            class="h-2 rounded-sm"
            :style="{ width: `${Math.max(result.voteShare * 1.1, 2)}px`, backgroundColor: partyColour(result.party) }"
          />
          <span class="truncate text-zinc-300">{{ scenario.party(result.party)?.shortName ?? result.candidateName }}</span>
        </div>
        <p v-if="hoveredSeat.turnout && hoveredSeat.electorate" class="pt-0.5 text-xs text-zinc-400">
          Turnout {{ Math.round((hoveredSeat.turnout / hoveredSeat.electorate) * 100) }}%
          ({{ hoveredSeat.turnout.toLocaleString() }} / {{ hoveredSeat.electorate.toLocaleString() }})
        </p>
      </div>

      <div
        v-if="hoveredDemographics"
        class="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-zinc-700 pt-1.5 text-xs text-zinc-300"
      >
        <span v-if="hoveredDemographics.populationDensityPerKm2">
          Density: {{ Math.round(hoveredDemographics.populationDensityPerKm2).toLocaleString() }}/km²
        </span>
        <span v-if="hoveredDemographics.employmentRatePct">Employment: {{ hoveredDemographics.employmentRatePct }}%</span>
        <span v-if="hoveredDemographics.unemploymentRatePct">Unemployment: {{ hoveredDemographics.unemploymentRatePct }}%</span>
        <span v-if="hoveredDemographics.economicInactivityRatePct">
          Inactive: {{ hoveredDemographics.economicInactivityRatePct }}%
        </span>
        <span v-if="hoveredDemographics.medianAge">Median age: {{ hoveredDemographics.medianAge }}</span>
        <span v-if="hoveredDemographics.medianHouseholdIncomeGBP">
          Income: £{{ hoveredDemographics.medianHouseholdIncomeGBP.toLocaleString() }}
        </span>
        <span v-if="hoveredDemographics.source === 'estimated'" class="col-span-2 italic text-zinc-500">
          Some figures estimated
        </span>
      </div>
    </div>

    <div class="absolute bottom-3 right-3 flex flex-col gap-1.5">
      <button
        type="button"
        aria-label="Zoom in"
        class="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900/90 text-lg font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="isActive || zoom >= MAX_ZOOM"
        @click="zoomIn"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        class="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900/90 text-lg font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="isActive || zoom <= MIN_ZOOM"
        @click="zoomOut"
      >
        −
      </button>
      <button
        type="button"
        aria-label="Reset zoom"
        class="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900/90 text-xs font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="isActive || (zoom === 1 && panX === 0 && panY === 0)"
        @click="resetZoom"
      >
        ⟲
      </button>
    </div>
  </div>
</template>
