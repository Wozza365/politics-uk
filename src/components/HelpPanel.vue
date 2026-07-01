<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'
import { useFocusTrap } from '@/composables/useFocusTrap'
import HudPanel from '@/components/HudPanel.vue'
import IconButton from '@/components/IconButton.vue'
import PanelHeader from '@/components/PanelHeader.vue'

const ui = useUiStore()
const panel = ref<HTMLElement | null>(null)
useFocusTrap(panel, () => ui.closeHelpPanel(), computed(() => ui.helpPanelOpen))

const entries = [
  ['Polling vs projection', 'Polling is the vote-share snapshot. Projection translates it into Commons seats.'],
  ['National vs local impact', 'National effects move the field. Local influence matters in named seats and live contests.'],
  ['Resource and cooldown', 'Money is spent, capacity can be held, and cooldowns prevent repeated use.'],
  ['Contested election', 'A pending contest can be actioned from the elections panel before it resolves.'],
  ['Scenario baseline', 'Starting data is a scenario snapshot. Live play records only simulated campaign changes.'],
  ['Model language', 'Feed and result text describes this simulation, not real-world reporting or predictions.'],
]
</script>

<template>
  <Transition name="puk-panel">
    <HudPanel
      v-if="ui.helpPanelOpen"
      class="absolute left-1/2 top-20 z-40 max-h-[calc(100vh-7rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto text-sm"
      role="dialog"
      aria-modal="false"
      aria-label="Glossary"
    >
      <div ref="panel" class="contents">
      <PanelHeader title="Glossary">
        <template #actions>
          <IconButton label="Close glossary" size="sm" @click="ui.closeHelpPanel()">
            <X class="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </template>
      </PanelHeader>
      <dl class="hud-panel-body space-y-3">
        <div v-for="[term, definition] in entries" :key="term" class="border-t border-puk-border-subtle pt-3 first:border-t-0 first:pt-0">
          <dt class="font-semibold text-puk-text">{{ term }}</dt>
          <dd class="mt-1 text-xs leading-5 text-puk-text-muted">{{ definition }}</dd>
        </div>
      </dl>
      </div>
    </HudPanel>
  </Transition>
</template>
