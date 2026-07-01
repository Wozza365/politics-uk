<script setup lang="ts">
// Compact HUD status text (P3.1 acceptance criteria: "accessible announcements" for the rolling
// autosave) — never claims success before the scheduler's write actually resolves.
import { computed } from 'vue'
import { useSaveStore } from '@/stores/save'

const save = useSaveStore()

const statusLabel = computed(() => {
  if (save.lastWriteError) return 'Save failed'
  if (save.saving) return 'Saving…'
  if (save.lastSavedAt) return 'Saved'
  return ''
})

const statusState = computed(() => {
  if (save.lastWriteError) return 'error'
  if (save.saving) return 'saving'
  if (save.lastSavedAt) return 'saved'
  return 'idle'
})
</script>

<template>
  <p
    aria-live="polite"
    class="save-status text-xs"
    :data-state="statusState"
  >
    {{ statusLabel }}
  </p>
</template>
