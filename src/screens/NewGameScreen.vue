<script setup lang="ts">
import { computed, ref } from 'vue'
import { useScenarioStore } from '@/stores/scenario'
import { useGameStore } from '@/stores/game'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'
import PartyCard from '@/components/PartyCard.vue'
import { computeDifficulty, DIFFICULTY_LABELS } from '@/sim/difficulty'

interface TimelineStop {
  scenarioId: string
  date: string
  label: string
}

const scenario = useScenarioStore()
const game = useGameStore()
const save = useSaveStore()
const ui = useUiStore()

const timelineStops: TimelineStop[] = [
  { scenarioId: scenario.scenario.id, date: scenario.scenario.date, label: '1 January 2025' },
]
const selectedStopIndex = ref(0)
const selectedStop = computed(() => timelineStops[selectedStopIndex.value])
const campaign = computed(() => scenario.scenario.campaign)
const primaryObjective = computed(() => campaign.value?.primaryObjectives[0])
const optionalObjectives = computed(() => campaign.value?.optionalObjectives.filter((objective) => objective.kind !== 'hidden') ?? [])
const objectiveSummary = computed(() => {
  const primary = campaign.value?.primaryObjectives.length ?? 0
  const optional = optionalObjectives.value.length
  return `${primary} primary / ${optional} optional`
})

const nationalParties = computed(() =>
  scenario.scenario.parties.filter((party) => party.scope === 'national'),
)

const selectedPartyId = ref<string | null>(null)
const selectedParty = computed(() => (selectedPartyId.value ? scenario.party(selectedPartyId.value) : undefined))

function commonsSeatsFor(partyId: string) {
  return scenario.commonsRegions.filter((region) =>
    region.seats.some((seat) => seat.party === partyId),
  ).length
}

const selectedPartyStats = computed(() => {
  if (!selectedParty.value) return null
  const leader = selectedParty.value.leadership.find((officer) => officer.role === 'leader')
  const band = computeDifficulty(selectedParty.value, scenario.scenario)
  return {
    leader: leader?.personName ?? 'Leader TBC',
    seats: commonsSeatsFor(selectedParty.value.id),
    polling: scenario.scenario.polling[selectedParty.value.id] ?? 0,
    difficulty: DIFFICULTY_LABELS[band],
  }
})

function formatIsoDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function selectParty(partyId: string) {
  selectedPartyId.value = partyId
}

async function startGame() {
  if (!selectedPartyId.value) return
  if (game.selectedPartyId) {
    const confirmed = await ui.requestConfirm({
      title: 'Start a new campaign?',
      message: 'You have an active campaign in progress. Starting a new one replaces its autosave - any manual saves you made are unaffected.',
      confirmLabel: 'Start new campaign',
    })
    if (!confirmed) return
  }
  await save.startNewGame(selectedPartyId.value)
  ui.goToLoading()
}
</script>

<template>
  <main class="puk-screen-shell overflow-y-auto">
    <section class="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          class="rounded-[var(--puk-radius-control)] border border-puk-border px-3 py-2 text-sm font-semibold text-puk-text-muted transition hover:bg-puk-surface-raised hover:text-puk-text"
          @click="ui.goToTitle"
        >
          <- Back
        </button>
        <div class="text-right">
          <p class="puk-screen-kicker">Campaign setup</p>
          <h1 class="mt-1 text-2xl font-bold text-puk-text sm:text-3xl">Open a new campaign desk</h1>
        </div>
      </header>

      <section
        v-if="campaign"
        class="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.85fr)]"
        aria-label="Scenario briefing"
      >
        <article class="puk-screen-panel overflow-hidden">
          <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div class="p-5 sm:p-6">
              <p class="puk-screen-kicker">Scenario briefing</p>
              <h2 class="mt-3 text-2xl font-bold leading-tight text-puk-text">
                {{ campaign.briefing.headline }}
              </h2>
              <p class="mt-4 max-w-3xl text-sm leading-6 text-puk-text-muted sm:text-base">
                {{ campaign.briefing.summary }}
              </p>
              <dl class="mt-5 grid gap-3 sm:grid-cols-3">
                <div class="puk-stat-tile">
                  <dt class="puk-stat-label">Start date</dt>
                  <dd class="puk-stat-value mt-2 text-base font-semibold">{{ formatIsoDate(selectedStop.date) }}</dd>
                </div>
                <div class="puk-stat-tile">
                  <dt class="puk-stat-label">Election horizon</dt>
                  <dd class="puk-stat-value mt-2 text-base font-semibold">
                    {{ formatIsoDate(campaign.electoralHorizon.expectedEndDate) }}
                  </dd>
                </div>
                <div class="puk-stat-tile">
                  <dt class="puk-stat-label">Objectives</dt>
                  <dd class="puk-stat-value mt-2 text-base font-semibold">{{ objectiveSummary }}</dd>
                </div>
              </dl>
            </div>

            <div class="relative min-h-64 overflow-hidden border-t border-puk-border-subtle bg-puk-map-backdrop lg:border-l lg:border-t-0">
              <div class="absolute inset-4 rounded-[var(--puk-radius-card)] border border-puk-border-subtle bg-puk-surface/70">
                <div class="absolute inset-x-5 top-6 h-px bg-puk-premium-accent/70"></div>
                <div class="absolute inset-x-8 top-14 h-px bg-puk-player-focus/50"></div>
                <div class="absolute bottom-8 left-6 right-10 h-24 rounded-t-full border-t border-puk-text/15"></div>
                <div class="absolute bottom-12 left-10 right-14 h-16 rounded-t-full border-t border-puk-text/20"></div>
                <div class="absolute bottom-16 left-16 right-20 h-8 rounded-t-full border-t border-puk-text/25"></div>
                <div class="absolute left-6 top-24 h-16 w-20 border border-puk-border bg-puk-surface-raised/80"></div>
                <div class="absolute right-6 top-20 h-20 w-16 border border-puk-border bg-puk-surface-raised/70"></div>
              </div>
              <p class="absolute bottom-5 left-5 right-5 text-xs font-semibold uppercase tracking-[0.08em] text-puk-text-muted">
                Field operation
              </p>
            </div>
          </div>
        </article>

        <aside class="puk-screen-panel flex flex-col gap-4 p-5">
          <div>
            <label for="timeline-slider" class="puk-stat-label">Timeline</label>
            <input
              id="timeline-slider"
              v-model.number="selectedStopIndex"
              type="range"
              min="0"
              :max="timelineStops.length - 1"
              step="1"
              :disabled="timelineStops.length <= 1"
              class="mt-3 w-full accent-sky-400 disabled:opacity-45"
            />
            <p class="mt-2 text-lg font-semibold text-puk-text">{{ selectedStop.label }}</p>
            <p class="mt-1 text-xs text-puk-text-muted">{{ campaign.electoralHorizon.description }}</p>
          </div>

          <div class="border-t border-puk-border-subtle pt-4">
            <p class="puk-stat-label">Primary objective</p>
            <p class="mt-2 text-sm font-semibold text-puk-text">{{ primaryObjective?.title ?? 'Win the next election' }}</p>
            <p class="mt-1 text-xs leading-5 text-puk-text-muted">{{ primaryObjective?.description }}</p>
          </div>

          <div class="border-t border-puk-border-subtle pt-4">
            <p class="puk-stat-label">Optional objectives</p>
            <ul class="mt-2 space-y-2 text-xs leading-5 text-puk-text-muted">
              <li v-for="objective in optionalObjectives" :key="objective.id">
                <span class="font-semibold text-puk-text">{{ objective.title }}</span>: {{ objective.description }}
              </li>
            </ul>
          </div>

          <div class="border-t border-puk-border-subtle pt-4">
            <p class="puk-stat-label">Selected party</p>
            <div v-if="selectedParty && selectedPartyStats" class="mt-3 flex gap-3">
              <span
                class="puk-party-mark shrink-0"
                :style="{ '--party-accent': selectedParty.colours.primary, '--party-on-accent': selectedParty.colours.onPrimary }"
              >
                {{ selectedParty.shortName }}
              </span>
              <div class="min-w-0 text-sm">
                <p class="truncate font-semibold text-puk-text">{{ selectedParty.name }}</p>
                <p class="truncate text-xs text-puk-text-muted">{{ selectedPartyStats.leader }}</p>
                <p class="mt-1 text-xs text-puk-text-muted">
                  {{ selectedPartyStats.seats }} seats / {{ selectedPartyStats.polling }}% polling / {{ selectedPartyStats.difficulty }}
                </p>
              </div>
            </div>
            <p v-else class="mt-2 text-sm text-puk-text-muted">No party selected.</p>
          </div>
        </aside>
      </section>

      <section aria-labelledby="party-selection-heading" class="flex flex-1 flex-col gap-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="puk-screen-kicker">Party selection</p>
            <h2 id="party-selection-heading" class="mt-1 text-xl font-bold text-puk-text">Pick a campaign to run</h2>
          </div>
          <button
            type="button"
            class="rounded-[var(--puk-radius-control)] border border-puk-player-focus/60 bg-puk-player-focus/15 px-5 py-3 text-sm font-bold text-puk-text transition hover:bg-puk-player-focus/25 disabled:cursor-not-allowed disabled:border-puk-border disabled:bg-puk-surface disabled:text-puk-text-disabled"
            :disabled="!selectedPartyId"
            @click="startGame"
          >
            Start campaign
          </button>
        </div>

        <div class="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <PartyCard
            v-for="party in nationalParties"
            :key="party.id"
            :party="party"
            :selected="selectedPartyId === party.id"
            @select="selectParty"
          />
        </div>
      </section>
    </section>
  </main>
</template>
