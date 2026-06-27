<script setup lang="ts">
// In-game menu (P3.2 step 5): resume, manage saves, settings, return to main menu, restart.
// Opening it reuses the shared P2.8 pause gate (`ui.openMenus`) like every other in-game panel.
// "Manage saves" hands off to `SaveManagementPanel` without releasing the pause gate — the two
// panels trade places under one held "something is open" count rather than each managing its own.
import { useGameStore } from '@/stores/game'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { computed, ref } from 'vue'

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
  ui.closeGameMenu() // hand off to SaveManagementPanel without releasing the shared pause gate
  ui.toggleSaveManagementPanel()
}

async function returnToMainMenu() {
  const confirmed = await ui.requestConfirm({
    title: 'Return to main menu?',
    message: "Your campaign autosaves continuously, so nothing is lost. This pauses it at the title screen — pick Continue there to come back.",
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
    message: "This starts a brand-new campaign as the same party from day one. The current campaign's autosave is replaced — any manual saves you made are unaffected.",
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
  <section
    v-if="ui.gameMenuOpen"
    ref="panel"
    class="absolute left-1/2 top-24 z-30 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/90 shadow-2xl backdrop-blur-sm"
    aria-label="Game menu"
  >
    <header class="border-b border-zinc-800/80 px-4 py-3">
      <p class="text-sm font-semibold tracking-wide text-zinc-100">Menu</p>
    </header>

    <nav class="flex flex-col p-2" aria-label="Game menu actions">
      <button type="button" class="rounded-md px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800" @click="resume">
        Resume
      </button>
      <button type="button" class="rounded-md px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800" @click="manageSaves">
        Manage saves
      </button>
      <button type="button" class="cursor-not-allowed rounded-md px-3 py-2 text-left text-sm text-zinc-500" disabled aria-disabled="true">
        Settings
      </button>
      <button type="button" class="rounded-md px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800" @click="returnToMainMenu">
        Return to main menu
      </button>
      <button type="button" class="rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800" @click="restart">
        Restart campaign
      </button>
    </nav>
  </section>
</template>
