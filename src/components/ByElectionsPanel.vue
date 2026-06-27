<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useByElections } from '@/composables/useByElections'
import ContestCard from '@/components/ContestCard.vue'
import type { ISODate } from '@/types'

const ui = useUiStore()
const { commonsContests, councilContestsByWeek, actionsFor, actOnContest, focusOnMap } = useByElections()

// Weeks start collapsed — council by-elections are high-frequency, so showing every contest by
// default would bury the (much rarer, more newsworthy) parliamentary contests above.
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
  <section
    v-if="ui.byElectionsPanelOpen"
    class="hud-side-panel absolute bottom-44 right-4 top-[23rem] z-30 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-zinc-700/70 bg-zinc-950/90 shadow-2xl backdrop-blur-sm"
    aria-label="By-elections panel"
  >
    <header class="border-b border-zinc-800/80 px-4 py-3">
      <p class="text-sm font-semibold tracking-wide text-zinc-100">By-elections &amp; minor elections</p>
      <p class="text-xs text-zinc-400">
        {{ commonsContests.filter((c) => c.status === 'pending').length }} parliamentary contest(s) pending
      </p>
    </header>

    <div class="space-y-4 px-4 py-4">
      <div v-if="commonsContests.length">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Parliamentary</p>
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
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Council</p>
        <div class="space-y-2">
          <div v-for="group in councilContestsByWeek" :key="group.week" class="rounded-lg border border-zinc-800/80">
            <button
              type="button"
              class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-100"
              :aria-expanded="expandedWeeks.has(group.week)"
              @click="toggleWeek(group.week)"
            >
              <span>{{ group.contests.length }} council by-election{{ group.contests.length === 1 ? '' : 's' }} — week of {{ formatWeek(group.week) }}</span>
              <span>{{ expandedWeeks.has(group.week) ? '˄' : '˅' }}</span>
            </button>
            <div v-if="expandedWeeks.has(group.week)" class="space-y-2 border-t border-zinc-800/80 px-3 py-2">
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

      <p v-if="!commonsContests.length && !councilContestsByWeek.length" class="text-sm text-zinc-500">
        No by-elections called yet.
      </p>
    </div>
  </section>
</template>
