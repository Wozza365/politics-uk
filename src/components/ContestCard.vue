<script setup lang="ts">
import { ref } from 'vue'
import { HelpCircle, MapPinned } from '@lucide/vue'
import { useScenarioStore } from '@/stores/scenario'
import type { Contest, ContestActionId, ISODate } from '@/types'

interface AvailableContestAction {
  id: ContestActionId
  label: string
  description: string
  allowed: boolean
  disabledReason?: string
}

const props = defineProps<{ contest: Contest; actions: AvailableContestAction[] }>()
const emit = defineEmits<{ action: [actionId: ContestActionId]; focus: []; explain: [explanationId: string] }>()

const scenario = useScenarioStore()
const awaitingConfirmationFor = ref<ContestActionId | null>(null)

function partyName(partyId: string) {
  return scenario.party(partyId)?.shortName ?? partyId
}

function formatDate(date: ISODate) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function requiresConfirmation(actionId: ContestActionId) {
  return actionId === 'nationalise'
}

function onActionClick(action: AvailableContestAction) {
  if (!action.allowed) return
  if (requiresConfirmation(action.id) && awaitingConfirmationFor.value !== action.id) {
    awaitingConfirmationFor.value = action.id
    return
  }
  awaitingConfirmationFor.value = null
  emit('action', action.id)
}

function actionLabel(action: AvailableContestAction) {
  if (!action.allowed) return action.disabledReason ?? action.label
  if (awaitingConfirmationFor.value === action.id) return 'Confirm action'
  return action.label
}
</script>

<template>
  <div class="hud-record p-3">
    <div class="flex items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="truncate font-semibold text-puk-text">{{ contest.seatName }}</p>
        <p class="mt-1 text-xs text-puk-text-muted">
          Held by {{ partyName(contest.incumbentParty) }} / called {{ formatDate(contest.calledDate) }}
        </p>
      </div>
      <button type="button" class="hud-action-button shrink-0" @click.stop="$emit('focus')">
        <MapPinned class="h-4 w-4" aria-hidden="true" />
        Map
      </button>
    </div>

    <div v-if="contest.status === 'resolved'" class="mt-2 flex items-center justify-between gap-2">
      <p class="text-sm text-puk-text-muted">
        Result: <span class="font-semibold text-puk-text">{{ contest.resultLabel }}</span>
      </p>
      <button v-if="contest.explanationId" type="button" class="hud-action-button" @click="$emit('explain', contest.explanationId)">
        <HelpCircle class="h-4 w-4" aria-hidden="true" />
        Why
      </button>
    </div>

    <div v-else class="mt-3 grid gap-2">
      <button
        v-for="action in props.actions"
        :key="action.id"
        type="button"
        :title="action.allowed ? action.description : action.disabledReason"
        :disabled="!action.allowed"
        class="hud-action-button justify-between text-left"
        :class="{ 'hud-action-button--primary': awaitingConfirmationFor === action.id }"
        @click="onActionClick(action)"
        @blur="awaitingConfirmationFor = null"
      >
        <span class="min-w-0">
          <span class="block truncate">{{ actionLabel(action) }}</span>
          <span class="block truncate text-[0.7rem] font-normal opacity-75">{{ action.description }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
