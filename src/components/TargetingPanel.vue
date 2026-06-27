<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useTargeting } from '@/composables/useTargeting'
import { useFocusTrap } from '@/composables/useFocusTrap'
import TargetOptionRow from '@/components/TargetOptionRow.vue'

const game = useGameStore()
const ui = useUiStore()
const { options, focusOnMap } = useTargeting()
const panel = ref<HTMLElement | null>(null)

function close() {
  ui.closeTargetingPanel()
  ui.closeMenu()
  game.resumeClockIfClear()
}

useFocusTrap(panel, close, computed(() => ui.targetingPanelOpen))
</script>

<template>
  <section
    v-if="ui.targetingPanelOpen"
    ref="panel"
    class="hud-side-panel absolute right-4 top-56 z-30 max-h-[calc(100vh-15rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-zinc-700/70 bg-zinc-950/90 shadow-2xl backdrop-blur-sm"
    role="dialog"
    aria-modal="false"
    aria-label="Targeted campaigning panel"
  >
    <header class="flex items-start justify-between gap-3 border-b border-zinc-800/80 px-4 py-3">
      <div>
        <p class="text-sm font-semibold tracking-wide text-zinc-100">Targeted campaigning</p>
        <p class="text-xs text-zinc-400">Commit staff and money to a specific place for two weeks.</p>
      </div>
      <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800" @click="close">
        Close
      </button>
    </header>

    <div class="space-y-2 px-4 py-4">
      <TargetOptionRow
        v-for="option in options"
        :key="`${option.scope.kind}:${option.scope.tierId ?? option.scope.regionId ?? option.scope.contestId ?? ''}`"
        :label="option.label"
        :description="option.description"
        :forecast-summary="option.forecastSummary"
        :cooldown-days="option.cooldownDays"
        :allowed="option.allowed"
        :disabled-reason="option.disabledReason"
        :requires-confirmation="option.requiresConfirmation"
        :focus-geometry-ref="option.focusGeometryRef"
        @activate="option.run"
        @focus="option.focusGeometryRef && focusOnMap(option.focusGeometryRef)"
      />
    </div>
  </section>
</template>
