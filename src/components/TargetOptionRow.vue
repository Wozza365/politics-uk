<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  label: string
  description: string
  forecastSummary?: string
  cooldownDays: number
  allowed: boolean
  disabledReason?: string
  requiresConfirmation?: boolean
  focusGeometryRef?: string
}>()
const emit = defineEmits<{ activate: []; focus: [] }>()

const awaitingConfirmation = ref(false)

function onClick() {
  if (!props.allowed) return
  if (props.requiresConfirmation && !awaitingConfirmation.value) {
    awaitingConfirmation.value = true
    return
  }
  awaitingConfirmation.value = false
  emit('activate')
}

function buttonLabel() {
  if (props.cooldownDays > 0) return `Ready in ${props.cooldownDays}d`
  if (!props.allowed) return props.disabledReason ?? 'Unavailable'
  if (awaitingConfirmation.value) return 'Confirm?'
  return 'Launch campaign'
}
</script>

<template>
  <div class="w-full rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-left">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-zinc-300">{{ label }}</p>
      <!-- .stop: same reasoning as ContestCard's "View on map" — without it MapView's window
      click-elsewhere listener would immediately undo the focus this triggers. -->
      <button
        v-if="focusGeometryRef"
        type="button"
        class="shrink-0 text-xs text-zinc-400 underline transition hover:text-zinc-200"
        @click.stop="emit('focus')"
      >
        View on map
      </button>
    </div>
    <p class="mt-1 text-xs text-zinc-500">{{ description }}</p>
    <p v-if="forecastSummary" class="mt-1 text-xs text-zinc-600">{{ forecastSummary }}</p>
    <button
      type="button"
      class="mt-2 w-full rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2 py-1.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700/80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-800/80"
      :disabled="!allowed"
      :title="!allowed ? disabledReason : undefined"
      @click="onClick"
      @blur="awaitingConfirmation = false"
    >
      {{ buttonLabel() }}
    </button>
  </div>
</template>
