import { defineStore } from 'pinia'
import type {
  Contest,
  ContestActionId,
  EventCallbackContext,
  FeedEntry,
  GameEvent,
  GameSaveStateV1,
  ISODate,
  PartyFinance,
  PartyId,
  PollingSnapshot,
} from '@/types'
import { useScenarioStore } from './scenario'
import { useUiStore } from './ui'
import { nextPollingSnapshot, type PollingImpact } from '@/sim/poll'
import { EVENT_POOL, resolvePollingEffects, rollEventForDay } from '@/sim/events'
import { runEventCallback } from '@/sim/eventCallbacks'
import { WORLD_SALIENCE } from '@/sim/policies'
import { projectSeatsByParty } from '@/sim/projection'
import { seededUniform } from '@/sim/rng'
import { CONTEST_ACTIONS_BY_TIER, resolveContestAction, rollByElectionsForDay, startOfIsoWeek } from '@/sim/byElections'

/** Player-lever ids (P2.9 — spec §9.3 "Expanded … levers"); each maps to a cooldown so the player
 * can't spam the same lever every tick. */
export type LeverId = 'fundraising' | 'socialMedia'
const LEVER_COOLDOWN_DAYS: Record<LeverId, number> = {
  fundraising: 14,
  socialMedia: 7,
}

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

/** Drawn once per playthrough (P3.0 save contract) — not a sim calculation, so `crypto`'s entropy
 * rather than the seeded `mulberry32` PRNG is the right tool here; see `GameSaveStateV1`'s header
 * comment on `playthroughSeed`. */
function generatePlaythroughSeed(): number {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return bytes[0]
}

/** A `Record<PartyId, T>`-shaped save field, filtered down to ids the live scenario still
 * recognises — guards against a save referencing a party that's been removed/renamed since
 * (P3.0's "validate referenced party/tier/seat ids" hydration step). */
function pickKnownParties<T>(record: Record<PartyId, T>, knownPartyIds: Set<PartyId>): Record<PartyId, T> {
  const result: Record<PartyId, T> = {}
  for (const [partyId, value] of Object.entries(record)) {
    if (knownPartyIds.has(partyId)) result[partyId] = value
  }
  return result
}

/** `leverCooldowns` keys are `${partyId}:${leverId}` — both halves are validated against the live
 * scenario/lever set rather than just the party id, so a renamed/removed lever can't leave a
 * permanently-stuck cooldown behind. */
function pickKnownLeverCooldowns(record: Record<string, ISODate>, knownPartyIds: Set<PartyId>): Record<string, ISODate> {
  const result: Record<string, ISODate> = {}
  for (const [key, date] of Object.entries(record)) {
    const [partyId, leverId] = key.split(':')
    if (knownPartyIds.has(partyId) && leverId in LEVER_COOLDOWN_DAYS) result[key] = date
  }
  return result
}

function isKnownContest(contest: Contest, knownPartyIds: Set<PartyId>, commonsRegionIds: Set<string>, councilWardRegionIds: Set<string>): boolean {
  if (!knownPartyIds.has(contest.incumbentParty)) return false
  const pool = contest.contestTier === 'commons' ? commonsRegionIds : councilWardRegionIds
  return pool.has(contest.regionId)
}

/** Feed text for a poll release, e.g. "Latest poll: Lab 27.4% (+1.2), Con 24.1% (-0.6)." */
function describePollMovement(
  previous: Record<PartyId, number>,
  next: Record<PartyId, number>,
  scenario: ReturnType<typeof useScenarioStore>,
): string {
  const parts = Object.entries(next)
    .sort((a, b) => b[1] - a[1])
    .map(([partyId, value]) => {
      const delta = value - (previous[partyId] ?? 0)
      const sign = delta > 0 ? '+' : ''
      const name = scenario.party(partyId)?.shortName ?? partyId
      return `${name} ${value.toFixed(1)}% (${sign}${delta.toFixed(1)})`
    })
  return `Latest poll: ${parts.join(', ')}.`
}

export const useGameStore = defineStore('game', {
  state: () => ({
    selectedPartyId: null as PartyId | null,
    date: '' as ISODate,
    clock: { running: false, msPerDay: 15000 },
    polling: {} as Record<PartyId, number>,
    pollingHistory: [] as PollingSnapshot[],
    // Polling impacts (from events, action choices, callbacks) accumulated since the last
    // published poll — folded in all at once by `publishPoll`, not applied immediately, so a
    // poll release can weigh a run of small events against each other rather than each one
    // moving the headline number on its own (see `sim/poll.ts`'s `nextPollingSnapshot`).
    pendingPollImpacts: [] as PollingImpact[],
    // Live overlays of the scenario's starting finance/membership snapshot (mirrors `polling`'s
    // relationship to `scenario.scenario.polling`) — the levers below are the only things that
    // mutate these during play.
    finance: {} as Record<PartyId, PartyFinance>,
    membership: {} as Record<PartyId, number>,
    // Last-used date per `${partyId}:${leverId}` key, checked against `LEVER_COOLDOWN_DAYS`.
    leverCooldowns: {} as Record<string, ISODate>,
    feed: [] as FeedEntry[],
    // Runtime by-election/minor-election vacancies (P2.8, spec §9.5) — generated by
    // `rollByElectionsForDay` each tick rather than pre-authored; see `sim/byElections.ts`.
    contests: [] as Contest[],
    // An array so multiple action-required events could in principle queue up; the clock stays
    // paused while any remain (currently the roll only ever produces one per day).
    pendingEvents: [] as GameEvent[],
    // Ids of events that have fired (or, for action events, been resolved) this playthrough —
    // `once: true` (the default) events are excluded from future rolls once they're in here.
    firedEventIds: [] as string[],
    // Per-playthrough issue salience (spec §10.5.1 step 1); starts as the world baseline and
    // events can nudge it via `effects.salienceShift` / event callbacks.
    salience: { ...WORLD_SALIENCE } as Record<string, number>,
    // Set once the GE date is reached (spec §11.2 win check); null while the game is still
    // running. A screen (GameScreen) watches this to drive the start→loading→game→result loop.
    result: null as 'won' | 'lost' | null,
    // Drawn once per playthrough (P3.0) — see `generatePlaythroughSeed`'s header comment.
    playthroughSeed: 0,
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
    /** Projected Commons seats per party at the GE date under a uniform national swing from the
     * scenario's day-one polling to the live polling (P2.0) — distinct from `commonsSeatsByParty`,
     * which is the unchanged starting composition. */
    projectedCommonsSeatsByParty(state): Record<PartyId, number> {
      const scenario = useScenarioStore()
      return projectSeatsByParty(scenario.commonsRegions, scenario.scenario.polling, state.polling)
    },
    projectedPlayerSeatCount(state): number {
      if (!state.selectedPartyId) return 0
      return this.projectedCommonsSeatsByParty[state.selectedPartyId] ?? 0
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
    /** Days left before the selected party can use this lever again (0 = ready now). */
    leverCooldownRemaining(state): (leverId: LeverId) => number {
      return (leverId) => {
        if (!state.selectedPartyId) return 0
        const lastUsed = state.leverCooldowns[`${state.selectedPartyId}:${leverId}`]
        if (!lastUsed) return 0
        return Math.max(0, LEVER_COOLDOWN_DAYS[leverId] - daysBetween(lastUsed, state.date))
      }
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
      this.contests = []
      this.pendingPollImpacts = []
      this.finance = { ...scenario.scenario.finances }
      this.membership = { ...scenario.scenario.membership }
      this.leverCooldowns = {}
      this.salience = { ...WORLD_SALIENCE }
      this.result = null
      this.playthroughSeed = generatePlaythroughSeed()
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
          this.pendingPollImpacts.push(...resolved)
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
     * Advances the date and rolls the day's event (P1.12 — most days roll nothing). Polling no
     * longer moves every day: events/actions/callbacks only queue their `PollingImpact`s onto
     * `pendingPollImpacts`, and the headline numbers only change when a "publishesPoll" event
     * fires (`publishPoll`) — see `sim/poll.ts`'s `nextPollingSnapshot`. `extraImpacts` is the
     * seam for impacts from outside the event system (e.g. player actions); they queue the same
     * way and surface at the next poll release.
     */
    tickDay(extraImpacts: PollingImpact[] = []) {
      this.date = addDays(this.date, 1)
      this.pendingPollImpacts.push(...extraImpacts)
      const rolled = rollEventForDay(this.date, this.firedEventIds)
      this.rollByElections()

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
          const impacts = resolvePollingEffects(rolled.effects?.polling, this, `event:${rolled.id}`)
          this.pendingPollImpacts.push(...impacts)
          if (rolled.effects?.salienceShift) this.applySalienceShift(rolled.effects.salienceShift)
          runEventCallback(rolled.callbackId, this.buildCallbackContext(rolled, undefined, summary))
          if (rolled.publishesPoll) this.publishPoll(summary)
          this.recordFeedEntry({
            id: rolled.id,
            date: this.date,
            headline: rolled.headline,
            status: 'actioned',
            effect: [rolled.effects?.summary, ...summary].filter(Boolean).join(' ') || undefined,
          })
        }
      }

      this.checkElectionResult()
    },
    /** Win check (spec §11.2): once the GE date is reached, evaluate `projectedSeats >
     * totalSeats / 2` against a uniform-national-swing seat projection (P2.0, `sim/projection.ts`)
     * rather than the unchanged starting Commons composition, so polling movement during play
     * actually lands in the result. Action events still take priority that same day — the clock
     * stays paused on whichever came first, and the result stands once the queue drains. The GE
     * is the headline moment, not the end of the playthrough — see `continuePlaying`. */
    checkElectionResult() {
      if (this.result) return
      const scenario = useScenarioStore()
      const electionDate = scenario.scenario.nextElectionDate
      if (!electionDate || this.date < electionDate) return
      this.result = this.projectedPlayerSeatCount >= this.winThresholdSeats ? 'won' : 'lost'
      this.pauseClock()
    },
    /** The GE result is a headline moment, not a finale (spec §11.2 doesn't define what happens
     * after) — `ResultScreen.vue` calls this to drop the player back into live play with the
     * clock running again, rather than only offering a full restart. `result` is left set so
     * `checkElectionResult`'s guard above keeps it from re-firing for the same election. */
    continuePlaying() {
      this.resumeClock()
    },
    /** Generates this day's by-election/minor-election vacancies (P2.8, spec §9.5) and turns them
     * into feed entries. Parliamentary contests get one feed entry each; council contests are
     * grouped into one upserted "N council by-elections called this week" entry per ISO week —
     * both are narrative-only (`actions: []`) since the actual response is picked in the
     * by-elections panel, not via the feed's own action buttons. */
    rollByElections() {
      const scenario = useScenarioStore()
      const rolled = rollByElectionsForDay(this.date, scenario.commonsRegions, scenario.councilWardRegions, this.contests)
      if (!rolled.length) return
      this.contests.push(...rolled)

      for (const contest of rolled) {
        if (contest.contestTier !== 'commons') continue
        const partyName = scenario.party(contest.incumbentParty)?.shortName ?? contest.incumbentParty
        this.recordFeedEntry({
          id: contest.id,
          date: this.date,
          headline: `By-election called: ${contest.seatName} (${partyName} hold).`,
          status: 'unactioned',
          actions: [],
        })
      }

      if (rolled.some((contest) => contest.contestTier === 'council')) {
        const week = startOfIsoWeek(this.date)
        const weekEntryId = `byelection:council:week:${week}`
        const councilContestsThisWeek = this.contests.filter(
          (contest) => contest.contestTier === 'council' && startOfIsoWeek(contest.calledDate) === week,
        )
        const headline = `${councilContestsThisWeek.length} council by-election${councilContestsThisWeek.length === 1 ? '' : 's'} called this week.`
        const existing = this.feed.find((entry) => entry.id === weekEntryId)
        if (existing) {
          existing.headline = headline
        } else {
          this.recordFeedEntry({ id: weekEntryId, date: this.date, headline, status: 'unactioned', actions: [] })
        }
      }
    },
    /** Resolves a player's chosen response to a contest (P2.8) — narrative/polling-only, never
     * touches the underlying seat's `party` (see `sim/byElections.ts`'s module header on why that
     * overlay is deferred to P3.5). Updates the matching commons feed entry in place; council
     * contests stay under their weekly grouped entry. */
    actionContest(contestId: string, actionId: ContestActionId) {
      const contest = this.contests.find((candidate) => candidate.id === contestId)
      if (!contest || contest.status === 'resolved') return

      const { resultLabel, pollingImpacts } = resolveContestAction(contest, actionId, this.selectedPartyId)
      contest.status = 'resolved'
      contest.actionId = actionId
      contest.resultLabel = resultLabel
      this.pendingPollImpacts.push(...pollingImpacts)

      if (contest.contestTier === 'commons') {
        const entry = this.feed.find((candidate) => candidate.id === contest.id)
        if (entry) {
          entry.status = 'actioned'
          entry.actionTaken = CONTEST_ACTIONS_BY_TIER[contest.contestTier].find((action) => action.id === actionId)?.label
          entry.effect = resultLabel
          entry.actions = undefined
        }
      }
    },
    /** Folds every impact accumulated since the last release (plus this release's own
     * alignment/variance/trend) into a new polling snapshot, makes it the live number, and
     * appends it to history (spec — "set to the current poll, and the current poll added to the
     * history"). `summary` collects a feed-text line describing the movement. */
    publishPoll(summary: string[]) {
      const scenario = useScenarioStore()
      const polling = nextPollingSnapshot(scenario.scenario.parties, this.pollingHistory, this.date, {
        extraImpacts: this.pendingPollImpacts,
        alignment: { salience: this.salience },
      })
      summary.push(describePollMovement(this.polling, polling, scenario))
      this.polling = polling
      this.pollingHistory.push({ date: this.date, polling: { ...polling } })
      this.pendingPollImpacts = []
    },
    /** Fundraising lever (spec §9.3 "run appeals/drives to raise party finance"): a flat finance
     * gain with a seeded-deterministic amount, on a cooldown so it can't be spammed every tick. */
    runFundraisingAppeal() {
      const partyId = this.selectedPartyId
      if (!partyId || this.leverCooldownRemaining('fundraising') > 0) return
      const roll = seededUniform(`lever:fundraising:${partyId}:${this.date}`)
      const raised = Math.round(50_000 + roll * 150_000)
      const current = this.finance[partyId]
      this.finance[partyId] = { ...current, estimatedCashOnHand: (current?.estimatedCashOnHand ?? 0) + raised, source: 'estimated' }
      this.leverCooldowns[`${partyId}:fundraising`] = this.date
      const scenario = useScenarioStore()
      this.recordFeedEntry({
        id: `lever:fundraising:${this.date}`,
        date: this.date,
        headline: `${scenario.party(partyId)?.shortName ?? partyId} fundraising appeal raises £${raised.toLocaleString('en-GB')}.`,
        status: 'actioned',
      })
    },
    /** Social media lever (spec §9.3 "campaigns affecting polling / membership / reach"): grows
     * membership directly and queues a small `PollingImpact` through the same seam events/actions
     * use, surfacing at the next poll release rather than moving the headline number immediately. */
    runSocialMediaCampaign() {
      const partyId = this.selectedPartyId
      if (!partyId || this.leverCooldownRemaining('socialMedia') > 0) return
      const roll = seededUniform(`lever:socialMedia:${partyId}:${this.date}`)
      const membershipGain = Math.round(200 + roll * 800)
      this.membership[partyId] = (this.membership[partyId] ?? 0) + membershipGain
      this.pendingPollImpacts.push({ partyId, magnitude: 0.05 + roll * 0.1, source: 'lever:socialMedia' })
      this.leverCooldowns[`${partyId}:socialMedia`] = this.date
      const scenario = useScenarioStore()
      this.recordFeedEntry({
        id: `lever:socialMedia:${this.date}`,
        date: this.date,
        headline: `${scenario.party(partyId)?.shortName ?? partyId} social media campaign reaches new supporters (+${membershipGain.toLocaleString('en-GB')} members).`,
        status: 'actioned',
      })
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
      // `id` isn't unique across the whole feed for repeatable events (the same event can fire
      // more than once in a playthrough) — match the *unactioned* one, not whichever happens to
      // sit first in the array, or a stale already-actioned entry from an earlier occurrence
      // would silently swallow the click.
      const entry = this.feed.find((candidate) => candidate.id === entryId && candidate.status === 'unactioned')
      if (!entry) return
      const eventIndex = this.pendingEvents.findIndex((candidate) => candidate.id === entryId)
      const event = eventIndex >= 0 ? this.pendingEvents[eventIndex] : undefined
      const action = event?.actions?.find((candidate) => candidate.id === actionId)
      if (!event || !action) return

      const summary: string[] = []
      if (action.effects?.polling?.length) {
        const impacts = resolvePollingEffects(action.effects.polling, this, `event:${event.id}:${action.id}`)
        this.pendingPollImpacts.push(...impacts)
      }
      if (action.effects?.salienceShift) this.applySalienceShift(action.effects.salienceShift)
      runEventCallback(action.callbackId, this.buildCallbackContext(event, action.id, summary))
      if (event.publishesPoll) this.publishPoll(summary)

      entry.status = 'actioned'
      entry.actionTaken = action.label
      entry.effect = [action.effects?.summary, ...summary].filter(Boolean).join(' ') || undefined
      entry.actions = undefined

      this.firedEventIds.push(event.id)
      this.pendingEvents.splice(eventIndex, 1)
      this.resumeClockIfClear()
    },
    /** Generic "resolve whatever's at the front of the queue" entry point — `resolveFeedAction`
     * does the actual work once it can find the matching feed entry + action. */
    resolvePendingEvent(choiceId: string) {
      const event = this.pendingEvents[0]
      if (!event) return
      this.resolveFeedAction(event.id, choiceId)
    },
    /** Resumes the clock only if nothing else is holding it paused: no queued action event, and
     * no open menu (the shared `ui.openMenus` pause gate — P2.8, so the by-elections panel and
     * PartyPanel can cooperate without one panel's close prematurely resuming the clock while the
     * other is still open). */
    resumeClockIfClear() {
      const ui = useUiStore()
      if (this.pendingEvents.length === 0 && ui.openMenus === 0) this.resumeClock()
    },
    /** Projects this store's mutable state into the P3.0 save payload — the only thing
     * `stores/save.ts` is allowed to persist. `pendingEvents` are saved by id only (see
     * `GameSaveStateV1`'s header comment); everything else is a deep-enough copy that mutating the
     * live store afterwards can't reach back into the saved snapshot. */
    toSaveState(): GameSaveStateV1 {
      return {
        selectedPartyId: this.selectedPartyId,
        date: this.date,
        clockMsPerDay: this.clock.msPerDay,
        polling: { ...this.polling },
        pollingHistory: this.pollingHistory.map((snapshot) => ({ date: snapshot.date, polling: { ...snapshot.polling } })),
        pendingPollImpacts: this.pendingPollImpacts.map((impact) => ({ ...impact })),
        finance: Object.fromEntries(Object.entries(this.finance).map(([partyId, finance]) => [partyId, { ...finance }])),
        membership: { ...this.membership },
        leverCooldowns: { ...this.leverCooldowns },
        feed: this.feed.map((entry) => ({ ...entry, actions: entry.actions?.map((action) => ({ ...action })) })),
        contests: this.contests.map((contest) => ({ ...contest })),
        pendingEventIds: this.pendingEvents.map((event) => event.id),
        firedEventIds: [...this.firedEventIds],
        salience: { ...this.salience },
        result: this.result,
      }
    },
    /** Replaces this store's mutable state with a previously-saved payload (P3.0). Validates every
     * referenced party/region id against the *current* scenario rather than trusting the save
     * blindly — a save can outlive a scenario-data update — and always leaves the clock paused
     * regardless of what was saved, since resuming is an explicit player action
     * (`continuePlaying`/`resumeClock`), not something a load should do on its own. */
    hydrateFromSaveState(state: GameSaveStateV1) {
      const scenario = useScenarioStore()
      const knownPartyIds = new Set(scenario.scenario.parties.map((party) => party.id))
      const commonsRegionIds = new Set(scenario.commonsRegions.map((region) => region.id))
      const councilWardRegionIds = new Set(scenario.councilWardRegions.map((region) => region.id))

      this.selectedPartyId = state.selectedPartyId && knownPartyIds.has(state.selectedPartyId) ? state.selectedPartyId : null
      this.date = state.date
      this.clock = { running: false, msPerDay: state.clockMsPerDay }
      this.polling = pickKnownParties(state.polling, knownPartyIds)
      this.pollingHistory = state.pollingHistory.map((snapshot) => ({
        date: snapshot.date,
        polling: pickKnownParties(snapshot.polling, knownPartyIds),
      }))
      this.pendingPollImpacts = state.pendingPollImpacts.filter((impact) => knownPartyIds.has(impact.partyId)).map((impact) => ({ ...impact }))
      this.finance = pickKnownParties(state.finance, knownPartyIds)
      this.membership = pickKnownParties(state.membership, knownPartyIds)
      this.leverCooldowns = pickKnownLeverCooldowns(state.leverCooldowns, knownPartyIds)
      this.feed = state.feed.map((entry) => ({ ...entry, actions: entry.actions?.map((action) => ({ ...action })) }))
      this.contests = state.contests
        .filter((contest) => isKnownContest(contest, knownPartyIds, commonsRegionIds, councilWardRegionIds))
        .map((contest) => ({ ...contest }))
      this.pendingEvents = state.pendingEventIds
        .map((id) => EVENT_POOL.find((event) => event.id === id))
        .filter((event): event is GameEvent => !!event)
      this.firedEventIds = [...state.firedEventIds]
      this.salience = { ...WORLD_SALIENCE, ...state.salience }
      this.result = state.result
    },
  },
})
