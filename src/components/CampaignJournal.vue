<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import HudPanel from '@/components/HudPanel.vue'
import PanelHeader from '@/components/PanelHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
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
  if (status === 'succeeded') return 'border-puk-success/50 bg-puk-success/10 text-puk-text'
  if (status === 'failed' || status === 'expired') return 'border-puk-danger/50 bg-puk-danger/10 text-puk-text'
  if (objective?.kind === 'primary') return 'border-puk-player-focus/50 bg-puk-player-focus/10 text-puk-text'
  return 'border-puk-border-subtle bg-puk-map-backdrop/70 text-puk-text'
}

function statusTone(status: string): 'default' | 'success' | 'danger' | 'info' {
  if (status === 'succeeded') return 'success'
  if (status === 'failed' || status === 'expired') return 'danger'
  if (status === 'active') return 'info'
  return 'default'
}
</script>

<template>
  <HudPanel
    class="hud-journal absolute bottom-44 right-4 top-[23rem] z-20 flex w-80 max-w-[calc(100vw-2rem)] flex-col text-sm"
    aria-label="Campaign journal"
  >
    <PanelHeader title="Campaign journal" :subtitle="scenario.scenario.campaign?.electoralHorizon.label" />

    <div class="hud-panel-body min-h-0 flex-1 space-y-4 overflow-y-auto">
      <section>
        <p class="mb-2 text-xs font-semibold uppercase text-puk-text-muted">Objectives</p>
        <div class="space-y-2">
          <article
            v-for="record in visibleObjectiveRecords"
            :key="record.objectiveId"
            class="hud-record p-3"
            :class="objectiveTone(objectivesById.get(record.objectiveId), record.status)"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="font-semibold">{{ objectivesById.get(record.objectiveId)?.title }}</p>
              <StatusPill class="shrink-0" :tone="statusTone(record.status)">
                {{ statusLabel(record.status) }}
              </StatusPill>
            </div>
            <p class="mt-1 text-xs opacity-80">{{ objectivesById.get(record.objectiveId)?.description }}</p>
          </article>
        </div>
      </section>

      <section v-if="activeArcs.length">
        <p class="mb-2 text-xs font-semibold uppercase text-puk-text-muted">Open arcs</p>
        <article v-for="{ record, arc, stage } in activeArcs" :key="record.arcId" class="hud-record p-3">
          <p class="font-semibold text-puk-text">{{ arc.title }}</p>
          <p class="mt-1 text-xs text-puk-text-muted">{{ stage.summary }}</p>
        </article>
      </section>

      <section v-if="consequences.length">
        <p class="mb-2 text-xs font-semibold uppercase text-puk-text-muted">Consequences</p>
        <article v-for="consequence in consequences" :key="consequence.id" class="hud-record p-3">
          <p class="font-semibold text-puk-text">{{ consequence.label }}</p>
          <p class="mt-1 text-xs text-puk-text-muted">{{ consequence.summary }}</p>
        </article>
      </section>
    </div>
  </HudPanel>
</template>
