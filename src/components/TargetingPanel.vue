<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useTargeting } from '@/composables/useTargeting'
import TargetOptionRow from '@/components/TargetOptionRow.vue'

const ui = useUiStore()
const { options, focusOnMap } = useTargeting()
</script>

<template>
  <section
    v-if="ui.targetingPanelOpen"
    class="absolute right-4 top-24 z-30 max-h-[calc(100vh-7rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-zinc-700/70 bg-zinc-950/90 shadow-2xl backdrop-blur-sm"
    aria-label="Targeted campaigning panel"
  >
    <header class="border-b border-zinc-800/80 px-4 py-3">
      <p class="text-sm font-semibold tracking-wide text-zinc-100">Targeted campaigning</p>
      <p class="text-xs text-zinc-400">Commit staff and money to a specific place for two weeks.</p>
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
