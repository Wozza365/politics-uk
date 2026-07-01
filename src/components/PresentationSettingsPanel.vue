<script setup lang="ts">
import { computed, ref } from 'vue'
import { Volume2, X } from '@lucide/vue'
import { useGameStore } from '@/stores/game'
import { useUiStore, type MotionPreference } from '@/stores/ui'
import { useFocusTrap } from '@/composables/useFocusTrap'
import HudPanel from '@/components/HudPanel.vue'
import IconButton from '@/components/IconButton.vue'
import PanelHeader from '@/components/PanelHeader.vue'

const ui = useUiStore()
const game = useGameStore()
const panel = ref<HTMLElement | null>(null)
useFocusTrap(panel, close, computed(() => ui.presentationSettingsOpen))

const motionOptions: { label: string; value: MotionPreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Reduced', value: 'reduced' },
  { label: 'Standard', value: 'standard' },
]

function close() {
  ui.closePresentationSettings()
  ui.closeMenu()
  game.resumeClockIfClear()
}
</script>

<template>
  <Transition name="puk-panel">
    <HudPanel
      v-if="ui.presentationSettingsOpen"
      class="presentation-settings absolute left-1/2 top-20 z-40 max-h-[calc(100vh-7rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto text-sm"
      role="dialog"
      aria-modal="false"
      aria-label="Presentation settings"
    >
      <div ref="panel" class="contents">
        <PanelHeader title="Presentation" subtitle="Local preferences">
          <template #actions>
            <IconButton label="Close presentation settings" size="sm" @click="close">
              <X class="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </template>
        </PanelHeader>

        <div class="hud-panel-body space-y-4">
          <section class="presentation-settings-group">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-puk-text">Sound effects</p>
                <p class="mt-1 text-xs leading-5 text-puk-text-muted">Optional cues for panels, saves, events, and resolved actions.</p>
              </div>
              <label class="presentation-toggle">
                <input
                  type="checkbox"
                  :checked="ui.presentation.soundEnabled"
                  :disabled="ui.presentation.reducedSensory"
                  @change="ui.setSoundEnabled(($event.target as HTMLInputElement).checked)"
                />
                <span>{{ ui.presentation.soundEnabled ? 'On' : 'Off' }}</span>
              </label>
            </div>
            <label class="presentation-slider">
              <span><Volume2 class="h-4 w-4" aria-hidden="true" /> Effects volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="ui.presentation.soundEffectsVolume"
                :disabled="!ui.presentation.soundEnabled || ui.presentation.reducedSensory"
                @input="ui.setSoundEffectsVolume(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </section>

          <section class="presentation-settings-group">
            <p class="font-semibold text-puk-text">Ambience</p>
            <p class="mt-1 text-xs leading-5 text-puk-text-muted">Reserved for future low-volume room tone. No loop plays in this build.</p>
            <label class="presentation-slider">
              <span>Ambience volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="ui.presentation.ambienceVolume"
                :disabled="ui.presentation.reducedSensory"
                @input="ui.setAmbienceVolume(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </section>

          <section class="presentation-settings-group">
            <p class="font-semibold text-puk-text">Motion and sensory load</p>
            <div class="mt-3 grid gap-2">
              <label class="presentation-toggle presentation-toggle--wide">
                <input
                  type="checkbox"
                  :checked="ui.presentation.reducedSensory"
                  @change="ui.setReducedSensory(($event.target as HTMLInputElement).checked)"
                />
                <span>Reduced sensory mode</span>
              </label>
              <div class="presentation-motion-options" role="radiogroup" aria-label="Motion preference">
                <label v-for="option in motionOptions" :key="option.value">
                  <input
                    type="radio"
                    name="motion-preference"
                    :value="option.value"
                    :checked="ui.presentation.motionPreference === option.value"
                    @change="ui.setMotionPreference(option.value)"
                  />
                  <span>{{ option.label }}</span>
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>
    </HudPanel>
  </Transition>
</template>
