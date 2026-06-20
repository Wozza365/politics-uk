<script setup lang="ts">
// Loading screen (spec §8): centred spinner themed with the selected party's
// colour. All scenario data is already bundled (synchronous JSON imports), so
// there's nothing to actually fetch yet — this simulates a short load with a
// real async/await structure so swapping in real async loading later is a
// one-line change.
import { computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'

const game = useGameStore()
const ui = useUiStore()

const accentColour = computed(() => game.selectedParty?.colours.primary ?? '#FFFFFF')

onMounted(async () => {
  await new Promise((resolve) => setTimeout(resolve, 750))
  ui.goToGame()
})
</script>

<template>
  <main class="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-zinc-900">
    <div
      class="h-16 w-16 animate-spin rounded-full border-4 border-zinc-700"
      :style="{ borderTopColor: accentColour }"
    />
    <p class="text-xl font-medium text-zinc-100">Loading...</p>
  </main>
</template>
