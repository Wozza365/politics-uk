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
      class="hud-modal-surface max-h-[calc(100vh-2rem)] !w-[min(24rem,100%)] p-5"
    >
      <p class="text-sm font-semibold text-puk-text">{{ props.title }}</p>
      <p class="mt-2 text-sm text-puk-text-muted">{{ props.message }}</p>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="hud-action-button"
          @click="emit('cancel')"
        >
          {{ props.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          type="button"
          class="hud-action-button hud-action-button--danger"
          @click="emit('confirm')"
        >
          {{ props.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>
