<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import type { CampaignObjective } from '@/types'

const game = useGameStore()
const scenario = useScenarioStore()

const objectivesById = computed(() => new Map(game.campaignObjectiveDefinitions.map((objective) => [objective.id, objective])))
const visibleObjectiveRecords = computed(() =>
  game.campaignObjectives.filter((record) => {
    const objective = objectivesById.value.get(record.objectiveId)
    return objective && (objective.kind !== 'hidden' || record.availableAt || record.status === 'succeeded')
  }),
)

const activeArcs = computed(() =>
  game.campaignArcs
    .map((record) => {
      const arc = scenario.scenario.campaign?.arcs.find((candidate) => candidate.id === record.arcId)
      const stage = arc?.stages.find((candidate) => candidate.id === record.currentStageId)
      return arc && stage ? { record, arc, stage } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry && entry.record.status === 'active'),
)

const consequences = computed(() =>
  game.campaignArcs.flatMap((record) => record.consequences.map((consequence) => ({ ...consequence, arcId: record.arcId }))),
)

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function objectiveTone(objective: CampaignObjective | undefined, status: string) {
  if (status === 'succeeded') return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100'
  if (status === 'failed' || status === 'expired') return 'border-red-500/50 bg-red-500/10 text-red-100'
  if (objective?.kind === 'primary') return 'border-sky-500/50 bg-sky-500/10 text-sky-100'
  return 'border-zinc-700 bg-zinc-900/70 text-zinc-100'
}
</script>

<template>
  <section
    class="hud-journal absolute bottom-44 right-4 top-[23rem] z-20 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/85 text-sm shadow-2xl backdrop-blur-sm"
    aria-label="Campaign journal"
  >
    <header class="border-b border-zinc-800/80 px-4 py-3">
      <p class="text-sm font-semibold tracking-wide text-zinc-100">Campaign journal</p>
      <p class="text-xs text-zinc-400">{{ scenario.scenario.campaign?.electoralHorizon.label }}</p>
    </header>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <section>
        <p class="mb-2 text-xs font-semibold uppercase text-zinc-500">Objectives</p>
        <div class="space-y-2">
          <article
            v-for="record in visibleObjectiveRecords"
            :key="record.objectiveId"
            class="rounded-lg border p-3"
            :class="objectiveTone(objectivesById.get(record.objectiveId), record.status)"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="font-semibold">{{ objectivesById.get(record.objectiveId)?.title }}</p>
              <span class="shrink-0 text-[0.7rem] uppercase tracking-wide opacity-80">{{ statusLabel(record.status) }}</span>
            </div>
            <p class="mt-1 text-xs opacity-80">{{ objectivesById.get(record.objectiveId)?.description }}</p>
          </article>
        </div>
      </section>

      <section v-if="activeArcs.length">
        <p class="mb-2 text-xs font-semibold uppercase text-zinc-500">Open arcs</p>
        <article v-for="{ record, arc, stage } in activeArcs" :key="record.arcId" class="rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
          <p class="font-semibold text-zinc-100">{{ arc.title }}</p>
          <p class="mt-1 text-xs text-zinc-400">{{ stage.summary }}</p>
        </article>
      </section>

      <section v-if="consequences.length">
        <p class="mb-2 text-xs font-semibold uppercase text-zinc-500">Consequences</p>
        <article v-for="consequence in consequences" :key="consequence.id" class="rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
          <p class="font-semibold text-zinc-100">{{ consequence.label }}</p>
          <p class="mt-1 text-xs text-zinc-400">{{ consequence.summary }}</p>
        </article>
      </section>
    </div>
  </section>
</template>
