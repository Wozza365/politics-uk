<script setup lang="ts">
// Accessible confirm modal (P3.1 save policy: "confirm overwrites/deletions"). Generic — used by
// `SaveManagementPanel` for both the delete-slot and overwrite-on-import confirmations.
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const confirmButton = ref<HTMLButtonElement | null>(null)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => {
  confirmButton.value?.focus()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
    <div
      role="alertdialog"
      aria-modal="true"
      :aria-label="props.title"
      class="w-[min(24rem,100%)] rounded-2xl border border-zinc-700/70 bg-zinc-950 p-5 shadow-2xl"
    >
      <p class="text-sm font-semibold text-zinc-100">{{ props.title }}</p>
      <p class="mt-2 text-sm text-zinc-400">{{ props.message }}</p>
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          @click="emit('cancel')"
        >
          {{ props.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          ref="confirmButton"
          type="button"
          class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500"
          @click="emit('confirm')"
        >
          {{ props.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>
