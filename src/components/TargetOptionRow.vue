<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle2, Clock3, Lock, MapPinned, Target } from '@lucide/vue'

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
  if (awaitingConfirmation.value) return 'Confirm campaign'
  return 'Launch campaign'
}
</script>

<template>
  <div class="action-choice-card">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="action-choice-kicker">Targeted campaign</p>
        <p class="truncate text-sm font-semibold text-puk-text">{{ label }}</p>
      </div>
      <span class="action-choice-chip" :data-state="allowed ? 'ready' : 'blocked'">
        <CheckCircle2 v-if="allowed && cooldownDays === 0" class="h-3.5 w-3.5" aria-hidden="true" />
        <Clock3 v-else-if="cooldownDays > 0" class="h-3.5 w-3.5" aria-hidden="true" />
        <Lock v-else class="h-3.5 w-3.5" aria-hidden="true" />
        {{ cooldownDays > 0 ? `${cooldownDays}d` : allowed ? 'Ready' : 'Held' }}
      </span>
      <button
        v-if="focusGeometryRef"
        type="button"
        class="hud-action-button shrink-0"
        @click.stop="emit('focus')"
      >
        <MapPinned class="h-4 w-4" aria-hidden="true" />
        Map
      </button>
    </div>
    <p class="mt-2 text-xs leading-5 text-puk-text-muted">{{ description }}</p>
    <p v-if="forecastSummary" class="mt-2 action-choice-forecast">{{ forecastSummary }}</p>
    <button
      type="button"
      class="hud-action-button hud-action-button--primary mt-3 w-full"
      :disabled="!allowed"
      :title="!allowed ? disabledReason : undefined"
      @click="onClick"
      @blur="awaitingConfirmation = false"
    >
      <Target class="h-4 w-4" aria-hidden="true" />
      {{ buttonLabel() }}
    </button>
  </div>
</template>
