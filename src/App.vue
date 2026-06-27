<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useSaveStore } from '@/stores/save'
import TitleScreen from '@/screens/TitleScreen.vue'
import NewGameScreen from '@/screens/NewGameScreen.vue'
import LoadGameScreen from '@/screens/LoadGameScreen.vue'
import LoadingScreen from '@/screens/LoadingScreen.vue'
import RestoreScreen from '@/screens/RestoreScreen.vue'
import GameScreen from '@/screens/GameScreen.vue'
import ResultScreen from '@/screens/ResultScreen.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const ui = useUiStore()
// Wired once for the app's lifetime (P3.1) — startAutosave() is idempotent, so this is safe
// even though App.vue itself never unmounts/remounts.
useSaveStore().startAutosave()

const screens = {
  title: TitleScreen,
  newGame: NewGameScreen,
  loadGame: LoadGameScreen,
  loading: LoadingScreen,
  restoring: RestoreScreen,
  game: GameScreen,
  result: ResultScreen,
} as const

const currentScreen = computed(() => screens[ui.screen])
</script>

<template>
  <component :is="currentScreen" />
  <ConfirmDialog
    v-if="ui.confirmModal"
    :title="ui.confirmModal.request.title"
    :message="ui.confirmModal.request.message"
    :confirm-label="ui.confirmModal.request.confirmLabel"
    :cancel-label="ui.confirmModal.request.cancelLabel"
    @confirm="ui.resolveConfirm(true)"
    @cancel="ui.resolveConfirm(false)"
  />
</template>
