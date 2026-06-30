<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from '@lucide/vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useTargeting } from '@/composables/useTargeting'
import { useFocusTrap } from '@/composables/useFocusTrap'
import TargetOptionRow from '@/components/TargetOptionRow.vue'
import HudPanel from '@/components/HudPanel.vue'
import IconButton from '@/components/IconButton.vue'
import PanelHeader from '@/components/PanelHeader.vue'

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
  <HudPanel
    v-if="ui.targetingPanelOpen"
    class="hud-side-panel absolute bottom-44 right-4 top-[23rem] z-30 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto"
    role="dialog"
    aria-modal="false"
    aria-label="Targeted campaigning panel"
  >
    <div ref="panel" class="contents">
      <PanelHeader title="Targeted campaigning" subtitle="Commit staff and money to a specific place for two weeks.">
        <template #actions>
          <IconButton label="Close targeted campaigning panel" size="sm" @click="close">
            <X class="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </template>
      </PanelHeader>

      <div class="hud-panel-body space-y-2">
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
    </div>
  </HudPanel>
</template>
