<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useSaveStore } from '@/stores/save'
import StartScreen from '@/screens/StartScreen.vue'
import LoadingScreen from '@/screens/LoadingScreen.vue'
import GameScreen from '@/screens/GameScreen.vue'
import ResultScreen from '@/screens/ResultScreen.vue'

const ui = useUiStore()
// Wired once for the app's lifetime (P3.1) — startAutosave() is idempotent, so this is safe
// even though App.vue itself never unmounts/remounts.
useSaveStore().startAutosave()

const screens = {
  start: StartScreen,
  loading: LoadingScreen,
  game: GameScreen,
  result: ResultScreen,
} as const

const currentScreen = computed(() => screens[ui.screen])
</script>

<template>
  <component :is="currentScreen" />
</template>
