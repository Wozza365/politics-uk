<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from '@lucide/vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useFocusTrap } from '@/composables/useFocusTrap'
import IconButton from '@/components/IconButton.vue'
import ModalSurface from '@/components/ModalSurface.vue'
import PanelHeader from '@/components/PanelHeader.vue'

const game = useGameStore()
const ui = useUiStore()
const explanation = computed(() => (ui.activeExplanationId ? game.explanationById(ui.activeExplanationId) : undefined))
const dialog = ref<HTMLElement | null>(null)
useFocusTrap(dialog, () => ui.closeExplanation(), computed(() => !!explanation.value))
</script>

<template>
  <Transition name="puk-modal">
    <ModalSurface v-if="explanation" aria-label="Explanation details">
      <div ref="dialog" class="contents">
      <PanelHeader :title="explanation.title" :subtitle="`Model audit - ${explanation.summary}`">
        <template #actions>
          <IconButton label="Close explanation" size="sm" @click="ui.closeExplanation()">
            <X class="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </template>
      </PanelHeader>

      <div class="hud-panel-body space-y-3">
        <article v-for="group in explanation.groups" :key="group.id" class="hud-record p-3">
          <div class="flex items-start justify-between gap-3">
            <p class="font-semibold text-puk-text">{{ group.title }}</p>
            <span class="event-feed-chip">Audit trail</span>
          </div>
          <p class="mt-1 text-xs leading-5 text-puk-text-muted">{{ group.summary }}</p>
          <ul v-if="group.contributors.length" class="mt-3 space-y-1.5 text-xs text-puk-text-muted">
            <li
              v-for="contributor in group.contributors"
              :key="`${group.id}:${contributor.label}:${contributor.sourceId ?? ''}`"
              class="explanation-contributor"
            >
              <span class="font-semibold text-puk-text">{{ contributor.label }}</span>
              <span>{{ contributor.detail }}</span>
            </li>
          </ul>
        </article>
      </div>
      </div>
    </ModalSurface>
  </Transition>
</template>
