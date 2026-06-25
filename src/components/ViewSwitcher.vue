<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import type { GameView } from '@/stores/ui'

const ui = useUiStore()

const views: { id: GameView; label: string; available: boolean }[] = [
  { id: 'westminster', label: 'Westminster', available: true },
  { id: 'regional', label: 'Regional', available: true },
  { id: 'councils', label: 'Councils', available: true },
]
</script>

<template>
  <div class="flex items-center justify-center gap-2 px-3 py-3 text-sm" role="tablist" aria-label="Game views">
    <button
      v-for="view in views"
      :key="view.id"
      type="button"
      role="tab"
      :aria-selected="ui.activeView === view.id"
      :disabled="!view.available"
      :title="view.available ? undefined : `${view.label} — coming soon`"
      class="rounded-xl px-3 py-1 transition-colors disabled:cursor-not-allowed"
      :class="
        ui.activeView === view.id
          ? 'bg-zinc-100 text-zinc-900'
          : view.available
            ? 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
            : 'text-zinc-500'
      "
      @click="view.available && ui.setActiveView(view.id)"
    >
      {{ view.label }}
    </button>
  </div>
</template>
