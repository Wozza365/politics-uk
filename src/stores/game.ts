import { defineStore } from 'pinia'
import type { EventCallbackContext, FeedEntry, GameEvent, ISODate, PartyId } from '@/types'
import { useScenarioStore } from './scenario'
import { applyPollingImpacts, tickPolling, type PollingImpact } from '@/sim/poll'
import { resolvePollingEffects, rollEventForDay } from '@/sim/events'
import { runEventCallback } from '@/sim/eventCallbacks'
import { WORLD_SALIENCE } from '@/sim/policies'

/** Adds `days` whole days to an ISO date string ("2025-01-01" + 1 -> "2025-01-02"). */
function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole-day difference between two ISO date strings (`to` - `from`). */
function daysBetween(from: ISODate, to: ISODate): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const fromMs = new Date(`${from}T00:00:00Z`).getTime()
  const toMs = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((toMs - fromMs) / msPerDay)
}

export const useGameStore = defineStore('game', {
  state: () => ({
    selectedPartyId: null as PartyId | null,
    date: '' as ISODate,
    clock: { running: false, msPerDay: 15000 },
    polling: {} as Record<PartyId, number>,
    pollingHistory: [] as Array<{ date: ISODate; polling: Record<PartyId, number> }>,
    feed: [] as FeedEntry[],
    // An array so multiple action-required events could in principle queue up; the clock stays
    // paused while any remain (currently the roll only ever produces one per day).
    pendingEvents: [] as GameEvent[],
    // Ids of events that have fired (or, for action events, been resolved) this playthrough —
    // `once: true` (the default) events are excluded from future rolls once they're in here.
    firedEventIds: [] as string[],
    // Per-playthrough issue salience (spec §10.5.1 step 1); starts as the world baseline and
    // events can nudge it via `effects.salienceShift` / event callbacks.
    salience: { ...WORLD_SALIENCE } as Record<string, number>,
  }),
  getters: {
    selectedParty(state) {
      const scenario = useScenarioStore()
      return state.selectedPartyId ? scenario.party(state.selectedPartyId) : undefined
    },
    commonsSeatsByParty(): Record<PartyId, number> {
      const scenario = useScenarioStore()
      const counts: Record<PartyId, number> = {}
      for (const region of scenario.commonsRegions) {
        for (const seat of region.seats) {
          counts[seat.party] = (counts[seat.party] ?? 0) + 1
        }
      }
      return counts
    },
    playerSeatCount(state): number {
      if (!state.selectedPartyId) return 0
      return this.commonsSeatsByParty[state.selectedPartyId] ?? 0
    },
    playerPollingPct(state): number {
      if (!state.selectedPartyId) return 0
      return state.polling[state.selectedPartyId] ?? 0
    },
    winThresholdSeats(): number {
      const scenario = useScenarioStore()
      const totalCommonsSeats = scenario.commonsRegions.length
      return Math.floor(totalCommonsSeats / 2) + 1
    },
    daysUntilElection(state): number {
      const scenario = useScenarioStore()
      const nextElectionDate = scenario.scenario.nextElectionDate
      if (!nextElectionDate) return 0
      return daysBetween(state.date, nextElectionDate)
    },
  },
  actions: {
    startGame(partyId: PartyId) {
      const scenario = useScenarioStore()
      this.selectedPartyId = partyId
      this.date = scenario.scenario.date
      this.polling = { ...scenario.scenario.polling }
      this.pollingHistory = scenario.scenario.pollingHistory.map((snapshot) => ({
        date: snapshot.date,
        polling: { ...snapshot.polling },
      }))
      this.clock.running = false
      this.pendingEvents = []
      this.firedEventIds = []
      this.salience = { ...WORLD_SALIENCE }
    },
    /** Builds the narrow context an event callback (`sim/eventCallbacks.ts`) gets to work with —
     * closures over this store's own actions, so `sim/` never has to import `stores/`. */
    buildCallbackContext(event: GameEvent, actionId: string | undefined, summary: string[]): EventCallbackContext {
      return {
        event,
        actionId,
        date: this.date,
        selectedPartyId: this.selectedPartyId,
        commonsSeatsByParty: this.commonsSeatsByParty,
        applyPollingImpacts: (impacts) => {
          const resolved = resolvePollingEffects(impacts, this, `event:${event.id}:callback`)
          this.polling = applyPollingImpacts(this.polling, resolved)
        },
        bumpSalience: (policyId, delta) => this.applySalienceShift({ [policyId]: delta }),
        appendSummary: (text) => summary.push(text),
      }
    },
    /** Additive nudge to per-playthrough issue salience, clamped to [0,1] (spec §10.5.1 step 1). */
    applySalienceShift(shift: Record<string, number>) {
      for (const [policyId, delta] of Object.entries(shift)) {
        const current = this.salience[policyId] ?? 0
        this.salience[policyId] = Math.min(1, Math.max(0, current + delta))
      }
    },
    /**
     * Advances the date, rolls the day's event (P1.12 — most days roll nothing), and updates
     * polling for everyone (spec §10.5). `extraImpacts` is the seam for impacts from outside this
     * tick's own alignment/variance/event model — player actions or anything else that wants to
     * nudge a party's standing directly.
     */
    tickDay(extraImpacts: PollingImpact[] = []) {
      this.date = addDays(this.date, 1)
      const scenario = useScenarioStore()
      const rolled = rollEventForDay(this.date, this.firedEventIds)
      let impacts = [...extraImpacts]

      if (rolled) {
        if (rolled.actions?.length) {
          // Action events: queue it, pause the clock, render its choices in the feed. Effects
          // apply only once the player picks one (resolveFeedAction), not here.
          this.pendingEvents.push(rolled)
          this.recordFeedEntry({
            id: rolled.id,
            date: this.date,
            headline: rolled.headline,
            status: 'unactioned',
            actions: rolled.actions.map((action) => ({ id: action.id, label: action.label })),
          })
          this.pauseClock()
        } else {
          this.firedEventIds.push(rolled.id)
          const summary: string[] = []
          impacts = [...impacts, ...resolvePollingEffects(rolled.effects?.polling, this, `event:${rolled.id}`)]
          if (rolled.effects?.salienceShift) this.applySalienceShift(rolled.effects.salienceShift)
          runEventCallback(rolled.callbackId, this.buildCallbackContext(rolled, undefined, summary))
          this.recordFeedEntry({
            id: rolled.id,
            date: this.date,
            headline: rolled.headline,
            status: 'actioned',
            effect: [rolled.effects?.summary, ...summary].filter(Boolean).join(' ') || undefined,
          })
        }
      }

      this.polling = tickPolling(this.polling, scenario.scenario.parties, this.date, {
        extraImpacts: impacts,
        alignment: { salience: this.salience },
      })
      this.pollingHistory.push({ date: this.date, polling: { ...this.polling } })
    },
    pauseClock() {
      this.clock.running = false
    },
    resumeClock() {
      this.clock.running = true
    },
    recordFeedEntry(entry: FeedEntry) {
      this.feed.push(entry)
    },
    /** The feed's per-entry action buttons are the player's main lever on the game loop
     * (P1.12.3): resolving one applies that action's effects through the engine, records the
     * choice + its effect under the headline, and resumes the clock once no events remain. */
    resolveFeedAction(entryId: string, actionId: string) {
      const entry = this.feed.find((candidate) => candidate.id === entryId)
      if (!entry || entry.status !== 'unactioned') return
      const eventIndex = this.pendingEvents.findIndex((candidate) => candidate.id === entryId)
      const event = eventIndex >= 0 ? this.pendingEvents[eventIndex] : undefined
      const action = event?.actions?.find((candidate) => candidate.id === actionId)
      if (!event || !action) return

      const summary: string[] = []
      if (action.effects?.polling?.length) {
        const impacts = resolvePollingEffects(action.effects.polling, this, `event:${event.id}:${action.id}`)
        this.polling = applyPollingImpacts(this.polling, impacts)
      }
      if (action.effects?.salienceShift) this.applySalienceShift(action.effects.salienceShift)
      runEventCallback(action.callbackId, this.buildCallbackContext(event, action.id, summary))

      entry.status = 'actioned'
      entry.actionTaken = action.label
      entry.effect = [action.effects?.summary, ...summary].filter(Boolean).join(' ') || undefined
      entry.actions = undefined

      this.firedEventIds.push(event.id)
      this.pendingEvents.splice(eventIndex, 1)
      if (this.pendingEvents.length === 0) this.resumeClock()
    },
    /** Generic "resolve whatever's at the front of the queue" entry point — `resolveFeedAction`
     * does the actual work once it can find the matching feed entry + action. */
    resolvePendingEvent(choiceId: string) {
      const event = this.pendingEvents[0]
      if (!event) return
      this.resolveFeedAction(event.id, choiceId)
    },
  },
})
