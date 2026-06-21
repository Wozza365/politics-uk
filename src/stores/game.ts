import { defineStore } from 'pinia'
import type { FeedEntry, ISODate, PartyId } from '@/types'
import { useScenarioStore } from './scenario'

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
    // No GameEvent type yet (that's P1.12's job) — typed loosely for now.
    pendingEvent: null as unknown | null,
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
    },
    tickDay() {
      this.date = addDays(this.date, 1)
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
    /** The feed's per-entry action buttons are the player's main lever on the game loop:
     * resolving one records the choice + a placeholder effect directly on the entry. */
    resolveFeedAction(entryId: string, actionId: string) {
      const entry = this.feed.find((candidate) => candidate.id === entryId)
      if (!entry || entry.status !== 'unactioned') return
      const action = entry.actions?.find((candidate) => candidate.id === actionId)
      if (!action) return
      entry.status = 'actioned'
      entry.actionTaken = action.label
      entry.effect = 'Effect pending — wired up once the simulation engine (P1.11) and event system (P1.12) land.'
      entry.actions = undefined
    },
    resolvePendingEvent(_choiceId: string) {
      // MVP scope: full effect-application (modifying polling/finances/etc. based on
      // the chosen option) arrives with P1.12's GameEvent system. For now we just
      // clear the pending event and let the clock resume.
      this.pendingEvent = null
      this.resumeClock()
    },
  },
})
