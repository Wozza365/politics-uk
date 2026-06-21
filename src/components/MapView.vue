<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useScenarioStore } from '@/stores/scenario'
import { SvgMapRenderer } from '@/map/SvgMapRenderer'
import type { BoundarySet, RegionState } from '@/map/MapRenderer'

const scenario = useScenarioStore()

const partyColour = (partyId: string) => scenario.party(partyId)?.colours.primary ?? '#9ca3af'

const container = ref<HTMLElement | null>(null)
const hovered = ref<string | null>(null)
const renderer = new SvgMapRenderer()

function buildRegionState(): RegionState {
  const state: RegionState = {}
  for (const region of scenario.commonsRegions) {
    const holder = region.seats[0]
    state[region.geometryRef] = {
      fill: holder ? partyColour(holder.party) : '#9ca3af',
      selected: hovered.value === region.geometryRef,
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
  const boundarySet: BoundarySet = {
    id: 'commons',
    topology: scenario.boundaries,
    objectKey: 'regions',
  }
  renderer.render(boundarySet, buildRegionState())
}

// --- Independent zoom/pan ---------------------------------------------
// Implemented as a CSS transform on the renderer's mount point rather than
// inside SvgMapRenderer, so the same controls work regardless of which
// MapRenderer backend is mounted (spec's renderer-abstraction goal).
const MIN_ZOOM = 1
const MAX_ZOOM = 6
const BUTTON_ZOOM_STEP = 1.3

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
  setZoom(zoom.value * BUTTON_ZOOM_STEP)
}

function zoomOut() {
  setZoom(zoom.value / BUTTON_ZOOM_STEP)
}

function resetZoom() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function onWheel(event: WheelEvent) {
  const factor = Math.exp(-event.deltaY * 0.001)
  setZoom(zoom.value * factor)
}

// Mouse drag-to-pan (only meaningful once zoomed in).
let dragStart = { x: 0, y: 0 }

function onMouseDown(event: MouseEvent) {
  if (zoom.value <= MIN_ZOOM) return
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

onMounted(() => {
  if (!container.value) return
  renderer.mount(container.value)
  renderer.setEvents({
    onRegionHover: (geometryRef) => {
      hovered.value = geometryRef
    },
  })
  draw()
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

watch(hovered, draw)
onUnmounted(() => {
  renderer.unmount()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

const hoveredRegion = () =>
  scenario.commonsRegions.find((r) => r.geometryRef === hovered.value)
</script>

<template>
  <div class="relative h-full w-full select-none">
    <div
      class="h-full w-full origin-center [transform:perspective(1400px)_rotateX(38deg)_rotateZ(-2deg)] [filter:drop-shadow(0_24px_24px_rgb(0_0_0/0.35))]"
    >
      <div class="absolute inset-0 translate-y-2 rounded-lg bg-zinc-800/80" aria-hidden="true" />
      <div
        ref="container"
        class="relative h-full w-full overflow-hidden rounded-lg bg-transparent"
        :style="{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center',
          cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
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
      class="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-zinc-900/90 px-3 py-1.5 text-sm text-white shadow-lg"
    >
      <p class="font-semibold">{{ hoveredRegion()?.name }}</p>
      <p class="text-zinc-300">
        {{ scenario.party(hoveredRegion()!.seats[0]?.party)?.name }} —
        {{ hoveredRegion()?.seats[0]?.memberName }}
      </p>
    </div>

    <div class="absolute bottom-3 right-3 flex flex-col gap-1.5">
      <button
        type="button"
        aria-label="Zoom in"
        class="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900/90 text-lg font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="zoom >= MAX_ZOOM"
        @click="zoomIn"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        class="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900/90 text-lg font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="zoom <= MIN_ZOOM"
        @click="zoomOut"
      >
        −
      </button>
      <button
        type="button"
        aria-label="Reset zoom"
        class="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900/90 text-xs font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="zoom === 1 && panX === 0 && panY === 0"
        @click="resetZoom"
      >
        ⟲
      </button>
    </div>
  </div>
</template>
