<script setup lang="ts">
import { useScenarioStore } from '@/stores/scenario'
import type { Contest, ContestActionDef, ContestActionId, ISODate } from '@/types'

defineProps<{ contest: Contest; actions: ContestActionDef[] }>()
defineEmits<{ action: [actionId: ContestActionId]; focus: [] }>()

const scenario = useScenarioStore()

function partyName(partyId: string) {
  return scenario.party(partyId)?.shortName ?? partyId
}

function formatDate(date: ISODate) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

    <p v-if="contest.status === 'resolved'" class="mt-2 text-sm text-zinc-300">Result: {{ contest.resultLabel }}</p>
    <div v-else class="mt-2 flex flex-wrap gap-2">
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        :title="action.description"
        class="rounded-lg border border-zinc-500 px-2 py-1 text-xs text-zinc-100 transition hover:bg-zinc-100 hover:text-zinc-900"
        @click="$emit('action', action.id)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>
