<script setup lang="ts">
import { ref } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps<{
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLElement | null>(null)
useFocusTrap(dialog, () => emit('cancel'))
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
    <div
      ref="dialog"
      role="alertdialog"
      aria-modal="true"
      :aria-label="props.title"
      class="max-h-[calc(100vh-2rem)] w-[min(24rem,100%)] overflow-y-auto rounded-lg border border-zinc-700/70 bg-zinc-950 p-5 shadow-2xl"
    >
      <p class="text-sm font-semibold text-zinc-100">{{ props.title }}</p>
      <p class="mt-2 text-sm text-zinc-400">{{ props.message }}</p>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="min-h-10 rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          @click="emit('cancel')"
        >
          {{ props.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          type="button"
          class="min-h-10 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500"
          @click="emit('confirm')"
        >
          {{ props.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>
