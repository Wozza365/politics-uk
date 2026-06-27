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
</script>

<template>
  <p
    aria-live="polite"
    class="text-xs"
    :class="save.lastWriteError ? 'text-red-400' : 'text-zinc-500'"
  >
    {{ statusLabel }}
  </p>
</template>
