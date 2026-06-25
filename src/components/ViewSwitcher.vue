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
</script>

<template>
  <div class="flex items-center justify-center gap-2 px-3 py-3 text-sm" role="tablist" aria-label="Game views">
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
</template>
