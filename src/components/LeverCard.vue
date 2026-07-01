<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle2, Clock3, Lock, Zap } from '@lucide/vue'

const props = defineProps<{
  label: string
  description: string
  forecastSummary?: string
  cooldownDays: number
  allowed: boolean
  disabledReason?: string
  /** High-cost/irreversible actions (multi-day commitments) get a second confirming click
   * instead of firing straight away — see `usePartyLevers.ts`'s `requiresConfirmation`. */
  requiresConfirmation?: boolean
}>()
const emit = defineEmits<{ activate: [] }>()

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
  if (awaitingConfirmation.value) return 'Confirm action'
  return props.label
}
</script>

<template>
  <div class="action-choice-card">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="action-choice-kicker">National action</p>
        <p class="truncate text-sm font-semibold text-puk-text">{{ label }}</p>
      </div>
      <span class="action-choice-chip" :data-state="allowed ? 'ready' : 'blocked'">
        <CheckCircle2 v-if="allowed && cooldownDays === 0" class="h-3.5 w-3.5" aria-hidden="true" />
        <Clock3 v-else-if="cooldownDays > 0" class="h-3.5 w-3.5" aria-hidden="true" />
        <Lock v-else class="h-3.5 w-3.5" aria-hidden="true" />
        {{ cooldownDays > 0 ? `${cooldownDays}d` : allowed ? 'Ready' : 'Held' }}
      </span>
    </div>
    <p class="mt-2 text-xs leading-5 text-puk-text-muted">{{ description }}</p>
    <p v-if="forecastSummary" class="mt-2 action-choice-forecast">{{ forecastSummary }}</p>
    <button
      type="button"
      class="hud-action-button mt-3 w-full"
      :class="awaitingConfirmation ? 'hud-action-button--danger' : 'hud-action-button--primary'"
      :disabled="!allowed"
      :title="!allowed ? disabledReason : undefined"
      @click="onClick"
      @blur="awaitingConfirmation = false"
    >
      <Zap class="h-4 w-4" aria-hidden="true" />
      {{ buttonLabel() }}
    </button>
  </div>
</template>
