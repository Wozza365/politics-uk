<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'
import { useByElections } from '@/composables/useByElections'
import ContestCard from '@/components/ContestCard.vue'
import HudPanel from '@/components/HudPanel.vue'
import PanelHeader from '@/components/PanelHeader.vue'
import type { ISODate } from '@/types'

const ui = useUiStore()
const { commonsContests, councilContestsByWeek, actionsFor, actOnContest, focusOnMap } = useByElections()

const expandedWeeks = ref(new Set<string>())
function toggleWeek(week: string) {
  if (expandedWeeks.value.has(week)) expandedWeeks.value.delete(week)
  else expandedWeeks.value.add(week)
}

function formatWeek(week: ISODate) {
  return new Date(`${week}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <HudPanel
    v-if="ui.byElectionsPanelOpen"
    class="hud-side-panel absolute bottom-44 right-4 top-[23rem] z-30 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto"
    aria-label="By-elections panel"
  >
    <PanelHeader
      title="By-elections & minor elections"
      :subtitle="`${commonsContests.filter((contest) => contest.status === 'pending').length} parliamentary contest(s) pending`"
    />

    <div class="hud-panel-body space-y-4">
      <div v-if="commonsContests.length">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-puk-text-muted">Parliamentary</p>
        <div class="space-y-2">
          <ContestCard
            v-for="contest in commonsContests"
            :key="contest.id"
            :contest="contest"
            :actions="actionsFor(contest)"
            @action="(actionId) => actOnContest(contest.id, actionId)"
            @focus="focusOnMap(contest)"
            @explain="ui.showExplanation"
          />
        </div>
      </div>

      <div v-if="councilContestsByWeek.length">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-puk-text-muted">Council</p>
        <div class="space-y-2">
          <div v-for="group in councilContestsByWeek" :key="group.week" class="hud-record">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-puk-text"
              :aria-expanded="expandedWeeks.has(group.week)"
              @click="toggleWeek(group.week)"
            >
              <span>
                {{ group.contests.length }} council by-election{{ group.contests.length === 1 ? '' : 's' }} -
                week of {{ formatWeek(group.week) }}
              </span>
              <ChevronDown v-if="expandedWeeks.has(group.week)" class="h-4 w-4 shrink-0" aria-hidden="true" />
              <ChevronRight v-else class="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
            <div v-if="expandedWeeks.has(group.week)" class="space-y-2 border-t border-puk-border-subtle px-3 py-2">
              <ContestCard
                v-for="contest in group.contests"
                :key="contest.id"
                :contest="contest"
                :actions="actionsFor(contest)"
                @action="(actionId) => actOnContest(contest.id, actionId)"
                @focus="focusOnMap(contest)"
                @explain="ui.showExplanation"
              />
            </div>
          </div>
        </div>
      </div>

      <p v-if="!commonsContests.length && !councilContestsByWeek.length" class="text-sm text-puk-text-disabled">
        No by-elections called yet.
      </p>
    </div>
  </HudPanel>
</template>
