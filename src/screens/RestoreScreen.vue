<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'
import { useScenarioStore } from '@/stores/scenario'

const save = useSaveStore()
const ui = useUiStore()
const scenario = useScenarioStore()

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref('')

const pendingEntry = computed(() => save.saves.find((entry) => entry.id === ui.pendingRestoreId))
const pendingParty = computed(() => (pendingEntry.value?.selectedPartyId ? scenario.party(pendingEntry.value.selectedPartyId) : undefined))
const accentColour = computed(() => pendingParty.value?.colours.primary ?? 'var(--puk-color-player-focus)')
const restoreLabel = computed(() => pendingEntry.value?.summary || pendingParty.value?.name || 'Selected campaign')

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
  <main class="puk-screen-shell grid place-items-center overflow-y-auto px-5 py-8">
    <section class="puk-screen-panel relative z-10 w-full max-w-lg p-5 text-center sm:p-6">
      <template v-if="status === 'loading'">
        <div class="mx-auto puk-loading-map !w-full max-w-sm" :style="{ '--loading-accent': accentColour }" aria-hidden="true"></div>
        <p class="puk-screen-kicker mt-6">Restoring save</p>
        <h1 class="mt-2 text-2xl font-bold text-puk-text" role="status" aria-live="polite">
          Rebuilding the campaign desk
        </h1>
        <p class="mt-2 text-sm text-puk-text-muted">{{ restoreLabel }}</p>
      </template>

      <template v-else-if="status === 'success'">
        <div
          class="mx-auto grid h-16 w-16 place-items-center rounded-[var(--puk-radius-card)] border border-puk-success/60 bg-puk-success/15 text-2xl font-black text-puk-success"
          aria-hidden="true"
        >
          OK
        </div>
        <p class="puk-screen-kicker mt-6">Campaign restored</p>
        <h1 class="mt-2 text-2xl font-bold text-puk-text" role="status" aria-live="polite">Ready at the desk</h1>
        <p class="mt-2 text-sm text-puk-text-muted">The clock is paused so you can review the campaign before resuming.</p>
        <button
          type="button"
          class="mt-6 rounded-[var(--puk-radius-control)] border border-puk-player-focus/60 bg-puk-player-focus/15 px-5 py-3 text-sm font-bold text-puk-text transition hover:bg-puk-player-focus/25"
          @click="continueToGame"
        >
          Continue
        </button>
      </template>

      <template v-else>
        <div
          class="mx-auto grid h-16 w-16 place-items-center rounded-[var(--puk-radius-card)] border border-puk-danger/60 bg-puk-danger/15 text-2xl font-black text-puk-danger"
          aria-hidden="true"
        >
          !
        </div>
        <p class="puk-screen-kicker mt-6">Restore failed</p>
        <h1 class="mt-2 text-2xl font-bold text-puk-text" role="alert">Could not restore this save</h1>
        <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-puk-text-muted">{{ errorMessage }}</p>
        <button
          type="button"
          class="mt-6 rounded-[var(--puk-radius-control)] border border-puk-border px-5 py-3 text-sm font-bold text-puk-text transition hover:bg-puk-surface-raised"
          @click="backToLoadList"
        >
          Back to load list
        </button>
      </template>
    </section>
  </main>
</template>
