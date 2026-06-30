<script setup lang="ts">
import { computed } from 'vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { useUiStore } from '@/stores/ui'
import type { GameView } from '@/stores/ui'
import type { CouncilLevelId } from '@/stores/scenario'

const ui = useUiStore()

type ViewTarget = {
  id: string
  label: string
  available: boolean
  view: GameView
  councilLevel?: CouncilLevelId
}

const views: ViewTarget[] = [
  { id: 'westminster', label: 'Commons', available: true, view: 'westminster' },
  { id: 'regional', label: 'Regional', available: true, view: 'regional' },
  { id: 'council-county', label: 'County', available: true, view: 'councils', councilLevel: 'county' },
  { id: 'council-local', label: 'Local', available: true, view: 'councils', councilLevel: 'local' },
]

const viewOptions = computed(() => views.map((view) => ({ value: view.id, label: view.label, disabled: !view.available })))
const selectedViewId = computed(() => views.find((view) => isSelected(view))?.id ?? 'westminster')
const rendererOptions = [
  { value: 'geographic', label: 'Geo', title: 'Geographic Westminster map' },
  { value: 'hex', label: 'Hex', title: 'Hex Westminster map' },
]

function isSelected(view: ViewTarget) {
  return ui.activeView === view.view && (!view.councilLevel || ui.activeCouncilLevel === view.councilLevel)
}

function selectView(view: ViewTarget) {
  if (!view.available) return
  if (view.councilLevel) ui.setActiveCouncilLevel(view.councilLevel)
  ui.setActiveView(view.view)
}

function selectViewById(value: string | number) {
  const view = views.find((candidate) => candidate.id === value)
  if (view) selectView(view)
}

function setWestminsterRenderer(renderer: 'geographic' | 'hex') {
  ui.setWestminsterRenderer(renderer)
  ui.setActiveView('westminster')
}

function selectRenderer(value: string | number) {
  setWestminsterRenderer(value === 'hex' ? 'hex' : 'geographic')
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2 px-3 py-3 text-sm">
    <SegmentedControl
      :options="viewOptions"
      :model-value="selectedViewId"
      label="Game views"
      @update:model-value="selectViewById"
    />

    <SegmentedControl
      :options="rendererOptions"
      :model-value="ui.westminsterRenderer"
      label="Westminster map renderer"
      @update:model-value="selectRenderer"
    />
  </div>
</template>
