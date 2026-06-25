<script setup lang="ts">
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
  { id: 'westminster', label: 'Westminster', available: true, view: 'westminster' },
  { id: 'regional', label: 'Regional', available: true, view: 'regional' },
  { id: 'council-county', label: 'County', available: true, view: 'councils', councilLevel: 'county' },
  { id: 'council-local', label: 'Local', available: true, view: 'councils', councilLevel: 'local' },
]

function isSelected(view: ViewTarget) {
  return ui.activeView === view.view && (!view.councilLevel || ui.activeCouncilLevel === view.councilLevel)
}

function selectView(view: ViewTarget) {
  if (!view.available) return
  if (view.councilLevel) ui.setActiveCouncilLevel(view.councilLevel)
  ui.setActiveView(view.view)
}

function setWestminsterRenderer(renderer: 'geographic' | 'hex') {
  ui.setWestminsterRenderer(renderer)
  ui.setActiveView('westminster')
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2 px-3 py-3 text-sm">
    <div class="flex items-center justify-center gap-2" role="tablist" aria-label="Game views">
      <button
        v-for="view in views"
        :key="view.id"
        type="button"
        role="tab"
        :aria-selected="isSelected(view)"
        :disabled="!view.available"
        :title="view.available ? undefined : `${view.label} - coming soon`"
        class="rounded-xl px-3 py-1 transition-colors disabled:cursor-not-allowed"
        :class="
          isSelected(view)
            ? 'bg-zinc-100 text-zinc-900'
            : view.available
              ? 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
              : 'text-zinc-500'
        "
        @click="selectView(view)"
      >
        {{ view.label }}
      </button>
    </div>

    <div class="flex items-center gap-1 rounded-lg bg-zinc-950/70 p-1" aria-label="Westminster map renderer">
      <button
        type="button"
        class="rounded-md px-2.5 py-1 transition-colors"
        :class="
          ui.activeView === 'westminster' && ui.westminsterRenderer === 'geographic'
            ? 'bg-zinc-100 text-zinc-900'
            : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
        "
        title="Geographic Westminster map"
        @click="setWestminsterRenderer('geographic')"
      >
        Geo
      </button>
      <button
        type="button"
        class="rounded-md px-2.5 py-1 transition-colors"
        :class="
          ui.activeView === 'westminster' && ui.westminsterRenderer === 'hex'
            ? 'bg-zinc-100 text-zinc-900'
            : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
        "
        title="Hex Westminster map"
        @click="setWestminsterRenderer('hex')"
      >
        Hex
      </button>
    </div>
  </div>
</template>
