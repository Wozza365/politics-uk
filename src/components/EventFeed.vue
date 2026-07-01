<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { AlertTriangle, CheckCircle2, Clock3, HelpCircle, Radio } from '@lucide/vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import type { EventScope, EventSeverity, FeedEntry, ISODate } from '@/types'

const game = useGameStore()
const ui = useUiStore()
const scrollEl = ref<HTMLElement | null>(null)

// Newest entry is appended at the bottom (spec §13 resolved: chronological == newest-at-bottom)
// — auto-scroll there as it appears.
watch(
  () => game.feed.length,
  async () => {
    await nextTick()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  },
)

function formatDate(date: ISODate) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const scopeLabels: Record<EventScope, string> = {
  local: 'Local',
  regional: 'Regional',
  national: 'National',
  international: 'International',
}

const severityLabels: Record<EventSeverity, string> = {
  minor: 'Routine',
  moderate: 'Watch',
  major: 'High stakes',
}

function entryScope(entry: FeedEntry): EventScope {
  if (entry.scope) return entry.scope
  if (entry.id.includes('byelection') || entry.id.includes('target')) return 'local'
  if (entry.id.includes('election')) return 'national'
  return 'national'
}

function entrySeverity(entry: FeedEntry): EventSeverity {
  if (entry.severity) return entry.severity
  if (entry.explanationId || entry.id.includes('election')) return 'major'
  return entry.status === 'unactioned' ? 'moderate' : 'minor'
}

function statusLabel(entry: FeedEntry) {
  if (entry.status === 'unactioned' && entry.actions?.length) return 'Decision'
  if (entry.status === 'unactioned') return 'Open'
  return 'Recorded'
}

function statusTone(entry: FeedEntry) {
  if (entry.status === 'unactioned' && entry.actions?.length) return 'urgent'
  if (entry.status === 'unactioned') return 'open'
  return 'resolved'
}
</script>

<template>
  <div ref="scrollEl" class="flex h-full flex-col gap-4 overflow-y-auto text-sm">
    <p v-if="!game.feed.length" class="event-feed-empty">
      The desk is quiet. Campaign and political developments will be logged here.
    </p>

    <TransitionGroup name="puk-feed" tag="div" class="contents">
      <article
        v-for="entry in game.feed"
        :key="entry.id"
        class="event-feed-card hud-record p-3"
        :data-status="entry.status"
        :data-severity="entrySeverity(entry)"
      >
        <div class="event-feed-meta">
          <span class="event-feed-chip">
            <Radio class="h-3.5 w-3.5" aria-hidden="true" />
            {{ scopeLabels[entryScope(entry)] }}
          </span>
          <span class="event-feed-chip" :data-severity="entrySeverity(entry)">
            <AlertTriangle class="h-3.5 w-3.5" aria-hidden="true" />
            {{ severityLabels[entrySeverity(entry)] }}
          </span>
          <span class="ml-auto tabular-nums">{{ formatDate(entry.date) }}</span>
        </div>

        <div class="mt-3 flex items-start gap-2">
          <Clock3 v-if="entry.status === 'unactioned'" class="mt-0.5 h-4 w-4 shrink-0 text-puk-warning" aria-hidden="true" />
          <CheckCircle2 v-else class="mt-0.5 h-4 w-4 shrink-0 text-puk-success" aria-hidden="true" />
          <div class="min-w-0">
            <p class="font-bold leading-snug text-puk-text">{{ entry.headline }}</p>
            <p v-if="entry.body" class="mt-1 text-xs leading-5 text-puk-text-muted">{{ entry.body }}</p>
          </div>
        </div>

        <p class="event-feed-status" :data-tone="statusTone(entry)">{{ statusLabel(entry) }}</p>

        <template v-if="entry.status === 'actioned'">
          <p v-if="entry.actionTaken" class="mt-2 text-xs font-semibold text-puk-text">
            Action: <span class="font-medium text-puk-text-muted">{{ entry.actionTaken }}</span>
          </p>
          <p v-if="entry.effect" class="mt-1 text-xs leading-5 text-puk-text-muted">{{ entry.effect }}</p>
          <button
            v-if="entry.explanationId"
            type="button"
            class="hud-action-button mt-2"
            @click="ui.showExplanation(entry.explanationId)"
          >
            <HelpCircle class="h-4 w-4" aria-hidden="true" />
            Why?
          </button>
        </template>

        <div v-else-if="entry.actions?.length" class="mt-3 grid gap-2">
          <button
            v-for="action in entry.actions"
            :key="action.id"
            type="button"
            class="event-choice-button"
            @click="game.resolveFeedAction(entry.id, action.id)"
          >
            <span class="truncate">{{ action.label }}</span>
            <span>Record choice</span>
          </button>
        </div>
      </article>
    </TransitionGroup>
  </div>
</template>
