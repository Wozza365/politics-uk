<script setup lang="ts">
// Restoring loading state (P3.2 step 4): reads+validates+hydrates `ui.pendingRestoreId` via the
// P3.0 save store, then either an explicit "Campaign restored" confirmation (no auto-timed
// transition — keyboard-operable and not racy in tests) or a recoverable failure with a route
// back to the load list. The restored game always comes back paused (`game.hydrateFromSaveState`
// never resumes the clock), so "Continue" is the player's own explicit first action.
import { onMounted, ref } from 'vue'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'

const save = useSaveStore()
const ui = useUiStore()

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref('')

onMounted(async () => {
  const id = ui.pendingRestoreId
  if (!id) {
    status.value = 'error'
    errorMessage.value = 'No save was selected.'
    return
  }
  const ok = await save.loadSave(id)
  if (ok) {
    status.value = 'success'
  } else {
    status.value = 'error'
    errorMessage.value = save.lastError?.message ?? 'This save could not be loaded.'
  }
})

function continueToGame() {
  ui.goToGame()
}

function backToLoadList() {
  ui.goToLoadGame()
}
</script>

<template>
  <main class="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-zinc-900 p-8 text-center text-zinc-100">
    <p v-if="status === 'loading'" class="text-lg" role="status" aria-live="polite">Restoring your campaign…</p>

    <template v-else-if="status === 'success'">
      <p class="text-lg font-semibold" role="status" aria-live="polite">Campaign restored.</p>
      <button
        type="button"
        class="rounded-md bg-zinc-100 px-6 py-2.5 text-sm font-semibold text-zinc-900"
        @click="continueToGame"
      >
        Continue
      </button>
    </template>

    <template v-else>
      <p class="text-lg font-semibold text-red-400" role="alert">Couldn't restore this save</p>
      <p class="max-w-md text-sm text-zinc-400">{{ errorMessage }}</p>
      <button
        type="button"
        class="rounded-md border border-zinc-700/70 px-6 py-2.5 text-sm text-zinc-100 hover:bg-zinc-800"
        @click="backToLoadList"
      >
        Back to load list
      </button>
    </template>
  </main>
</template>
