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

onMounted(() => {
  if (!container.value) return
  renderer.mount(container.value)
  renderer.setEvents({
    onRegionHover: (geometryRef) => {
      hovered.value = geometryRef
    },
  })
  draw()
})

watch(hovered, draw)
onUnmounted(() => renderer.unmount())

const hoveredRegion = () =>
  scenario.commonsRegions.find((r) => r.geometryRef === hovered.value)
</script>

<template>
  <div class="relative h-full w-full select-none">
    <div
      class="h-full w-full origin-center [transform:perspective(1400px)_rotateX(38deg)_rotateZ(-2deg)] [filter:drop-shadow(0_24px_24px_rgb(0_0_0/0.35))]"
    >
      <div class="absolute inset-0 translate-y-2 rounded-lg bg-zinc-800/80" aria-hidden="true" />
      <div ref="container" class="relative h-full w-full rounded-lg bg-zinc-200" />
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
  </div>
</template>
