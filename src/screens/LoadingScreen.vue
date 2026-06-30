<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'

const game = useGameStore()
const ui = useUiStore()

const accentColour = computed(() => game.selectedParty?.colours.primary ?? 'var(--puk-color-player-focus)')
const partyLabel = computed(() => game.selectedParty?.shortName ?? 'Campaign')

onMounted(async () => {
  await new Promise((resolve) => setTimeout(resolve, 750))
  game.resumeClockIfClear()
  ui.goToGame()
})
</script>

<template>
  <main class="puk-screen-shell grid place-items-center overflow-hidden px-5">
    <section class="relative z-10 flex w-full max-w-md flex-col items-center gap-5 text-center" role="status" aria-live="polite">
      <div class="puk-loading-map" :style="{ '--loading-accent': accentColour }" aria-hidden="true">
        <div class="absolute left-[18%] top-[25%] h-2 w-2 rounded-full" :style="{ backgroundColor: accentColour }"></div>
        <div class="absolute left-[48%] top-[44%] h-2 w-2 rounded-full" :style="{ backgroundColor: accentColour }"></div>
        <div class="absolute right-[22%] bottom-[28%] h-2 w-2 rounded-full" :style="{ backgroundColor: accentColour }"></div>
      </div>
      <div>
        <p class="puk-screen-kicker">Opening campaign desk</p>
        <h1 class="mt-2 text-2xl font-bold text-puk-text">{{ partyLabel }} operation loading</h1>
        <p class="mt-2 text-sm text-puk-text-muted">Preparing the map, clock, and campaign feed.</p>
      </div>
    </section>
  </main>
</template>
