<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import StartScreen from '@/screens/StartScreen.vue'
import LoadingScreen from '@/screens/LoadingScreen.vue'
import GameScreen from '@/screens/GameScreen.vue'

const ui = useUiStore()

const screens = {
  start: StartScreen,
  loading: LoadingScreen,
  game: GameScreen,
} as const

const currentScreen = computed(() => screens[ui.screen])
</script>

<template>
  <component :is="currentScreen" />
</template>
