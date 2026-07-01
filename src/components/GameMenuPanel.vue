<script setup lang="ts">
import { computed, ref } from 'vue'
import { Home, Play, RotateCcw, Save as SaveIcon, Settings } from '@lucide/vue'
import { useGameStore } from '@/stores/game'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'
import { useFocusTrap } from '@/composables/useFocusTrap'
import HudPanel from '@/components/HudPanel.vue'
import PanelHeader from '@/components/PanelHeader.vue'

const game = useGameStore()
const save = useSaveStore()
const ui = useUiStore()
const panel = ref<HTMLElement | null>(null)
useFocusTrap(panel, resume, computed(() => ui.gameMenuOpen))

function resume() {
  ui.closeGameMenu()
  ui.closeMenu()
  game.resumeClockIfClear()
}

function manageSaves() {
  ui.closeGameMenu()
  ui.toggleSaveManagementPanel()
}

async function returnToMainMenu() {
  const confirmed = await ui.requestConfirm({
    title: 'Return to main menu?',
    message: "Your campaign autosaves continuously, so nothing is lost. This pauses it at the title screen - pick Continue there to come back.",
    confirmLabel: 'Return to main menu',
  })
  if (!confirmed) return
  await save.saveNow()
  ui.closeGameMenu()
  ui.closeMenu()
  ui.goToTitle()
}

async function restart() {
  const partyId = game.selectedPartyId
  if (!partyId) return
  const confirmed = await ui.requestConfirm({
    title: 'Restart this campaign?',
    message: "This starts a brand-new campaign as the same party from day one. The current campaign's autosave is replaced - any manual saves you made are unaffected.",
    confirmLabel: 'Restart',
  })
  if (!confirmed) return
  ui.closeGameMenu()
  ui.closeMenu()
  await save.startNewGame(partyId)
  ui.goToLoading()
}
</script>

<template>
  <Transition name="puk-panel">
    <HudPanel
      v-if="ui.gameMenuOpen"
      class="absolute left-1/2 top-24 z-30 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2"
      aria-label="Game menu"
    >
      <div ref="panel" class="contents">
      <PanelHeader title="Menu" />

      <nav class="flex flex-col gap-1 p-2" aria-label="Game menu actions">
        <button type="button" class="hud-action-button justify-start" @click="resume">
          <Play class="h-4 w-4" aria-hidden="true" />
          Resume
        </button>
        <button type="button" class="hud-action-button justify-start" @click="manageSaves">
          <SaveIcon class="h-4 w-4" aria-hidden="true" />
          Manage saves
        </button>
        <button type="button" class="hud-action-button justify-start" disabled aria-disabled="true">
          <Settings class="h-4 w-4" aria-hidden="true" />
          Settings
        </button>
        <button type="button" class="hud-action-button justify-start" @click="returnToMainMenu">
          <Home class="h-4 w-4" aria-hidden="true" />
          Return to main menu
        </button>
        <button type="button" class="hud-action-button hud-action-button--danger justify-start" @click="restart">
          <RotateCcw class="h-4 w-4" aria-hidden="true" />
          Restart campaign
        </button>
      </nav>
      </div>
    </HudPanel>
  </Transition>
</template>
