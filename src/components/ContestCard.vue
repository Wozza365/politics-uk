<script setup lang="ts">
import { ref } from 'vue'
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

/** "Nationalise the race" is the one high-cost, high-risk-or-reward contest response — worth a
 * confirming click, same as a multi-day lever commitment (P3.3). */
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
  if (awaitingConfirmationFor.value === action.id) return 'Confirm?'
  return action.label
}
</script>

<template>
  <div class="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="font-semibold text-zinc-100">{{ contest.seatName }}</p>
      <!-- .stop: without it, MapView's window "click elsewhere deactivates" listener sees this
      same click's bubble pass after activate() has already run and immediately undoes it. -->
      <button
        type="button"
        class="shrink-0 text-xs text-zinc-400 underline transition hover:text-zinc-200"
        @click.stop="$emit('focus')"
      >
        View on map
      </button>
    </div>
    <p class="text-xs text-zinc-400">Held by {{ partyName(contest.incumbentParty) }} · called {{ formatDate(contest.calledDate) }}</p>

    <div v-if="contest.status === 'resolved'" class="mt-2 flex items-center justify-between gap-2">
      <p class="text-sm text-zinc-300">Result: {{ contest.resultLabel }}</p>
      <button
        v-if="contest.explanationId"
        type="button"
        class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
        @click="$emit('explain', contest.explanationId)"
      >
        Why?
      </button>
    </div>
    <div v-else class="mt-2 flex flex-wrap gap-2">
      <button
        v-for="action in props.actions"
        :key="action.id"
        type="button"
        :title="action.allowed ? action.description : action.disabledReason"
        :disabled="!action.allowed"
        class="rounded-lg border border-zinc-500 px-2 py-1 text-xs text-zinc-100 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-100"
        @click="onActionClick(action)"
        @blur="awaitingConfirmationFor = null"
      >
        {{ actionLabel(action) }}
      </button>
    </div>
  </div>
</template>
