import { defineStore } from 'pinia'
import type {
  ActionAvailability,
  ActionCost,
  ActionOutcome,
  ActiveCommitment,
  CampaignArcRecord,
  CampaignObjective,
  CampaignObjectiveRecord,
  Contest,
  ContestActionDef,
  ContestActionId,
  ElectionOutcome,
  ElectionSeatWinner,
  EventCallbackContext,
  FeedEntry,
  GameEvent,
  GameSaveStateV1,
  ISODate,
  LeverId,
  PartyFinance,
  PartyId,
  PollingSnapshot,
  TargetScope,
} from '@/types'
import { useScenarioStore } from './scenario'
import { useUiStore } from './ui'
import { nextPollingSnapshot, type PollingImpact } from '@/sim/poll'
import { EVENT_POOL, resolvePollingEffects, rollEventForDay } from '@/sim/events'
import { runEventCallback } from '@/sim/eventCallbacks'
import { WORLD_SALIENCE } from '@/sim/policies'
import { projectSeatsByParty } from '@/sim/projection'
import {
  advanceCommitmentsForDay,
  buildCommitment,
  canTakeAction,
  LEADERSHIP_ATTENTION_MAX,
  LEVER_ACTIONS,
  resolveLeverAction,
  STAFF_CAPACITY_BASE,
  STAFF_CAPACITY_MAX,
} from '@/sim/actions'
import { CONTEST_ACTIONS_BY_TIER, resolveContestAction, rollByElectionsForDay, startOfIsoWeek } from '@/sim/byElections'
import {
  clampLocalInfluence,
  isTargetingActionId,
  regionIdsForScope,
  resolveTargetingAction,
  targetActionId,
  TARGETED_CAMPAIGN,
} from '@/sim/targeting'
import { isOpponentCadenceDay, rankTargetingMoves, selectOpponentMove } from '@/sim/opponents'
import { resolveCommonsElection } from '@/sim/elections/commons'
import { applyArcChoice, evaluateArcAvailability, initialiseArcRecords } from '@/sim/arcs'
import { evaluateObjectiveRecords, flattenObjectives, initialiseObjectiveRecords, type ObjectiveEvaluationContext } from '@/sim/objectives'

/** Polling bonus a targeting commitment's accumulated local influence contributes to that party's
 * effort if they also action a by-election contest in the same region (P3.4 step 3 — "translate it
 * into contest probability... particularly in P2.8 by-elections"); a fraction of the influence
 * itself, never the influence value applied wholesale, so the contest bonus stays bounded and
 * small relative to the contest action's own effect. */
const CONTEST_INFLUENCE_BONUS_FACTOR = 0.5

export type { LeverId }

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

/** `leverCooldowns` keys are `${partyId}:${actionId}` — both halves are validated against the live
 * scenario/known-action space rather than just the party id, so a renamed/removed lever can't leave
 * a permanently-stuck cooldown behind. Split on the *first* colon only: a targeting `actionId`
 * (`targeting:seat:E14000530`, P3.4) contains colons of its own. */
function pickKnownLeverCooldowns(record: Record<string, ISODate>, knownPartyIds: Set<PartyId>): Record<string, ISODate> {
  const result: Record<string, ISODate> = {}
  for (const [key, date] of Object.entries(record)) {
    const separatorIndex = key.indexOf(':')
    const partyId = key.slice(0, separatorIndex)
    const actionId = key.slice(separatorIndex + 1)
    if (knownPartyIds.has(partyId) && (actionId in LEVER_ACTIONS || isTargetingActionId(actionId))) result[key] = date
  }
  return result
}

/** Drops commitments referencing a party the current scenario no longer recognises (P3.0's
 * hydration pattern — see `pickKnownParties`). Every commitment is either a lever or a P3.4
 * targeting commitment, so `actionId` is checked against both known spaces.  */
function pickKnownCommitments(commitments: ActiveCommitment[], knownPartyIds: Set<PartyId>): ActiveCommitment[] {
  return commitments.filter(
    (commitment) => knownPartyIds.has(commitment.partyId) && (commitment.actionId in LEVER_ACTIONS || isTargetingActionId(commitment.actionId)),
  )
}

function isKnownContest(contest: Contest, knownPartyIds: Set<PartyId>, commonsRegionIds: Set<string>, councilWardRegionIds: Set<string>): boolean {
  if (!knownPartyIds.has(contest.incumbentParty)) return false
  const pool = contest.contestTier === 'commons' ? commonsRegionIds : councilWardRegionIds
  return pool.has(contest.regionId)
}

function isKnownCommonsWinner(winner: ElectionSeatWinner, knownPartyIds: Set<PartyId>, commonsRegionIds: Set<string>): boolean {
  return knownPartyIds.has(winner.previousParty) && knownPartyIds.has(winner.winnerParty) && commonsRegionIds.has(winner.regionId)
}

function isKnownElectionOutcome(outcome: ElectionOutcome, knownPartyIds: Set<PartyId>, commonsRegionIds: Set<string>): boolean {
  return (
    outcome.tier === 'commons' &&
    outcome.winners.length === outcome.eligibleSeatCount &&
    outcome.winners.every((winner) => isKnownCommonsWinner(winner, knownPartyIds, commonsRegionIds))
  )
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
    // Last-used date per `${partyId}:${leverId}` key, checked against `LEVER_ACTIONS`'s
    // `cooldownDays`.
    leverCooldowns: {} as Record<string, ISODate>,
    // Permanent staff-capacity growth from completed "staffing" recruitment drives, on top of
    // `STAFF_CAPACITY_BASE` (P3.3) — capped at `STAFF_CAPACITY_MAX` by the `staffCapacity` getter.
    staffCapacityBonus: {} as Record<PartyId, number>,
    // Multi-day lever commitments in flight (P3.3) — advanced/expired on the daily tick by
    // `advanceCommitments`; see `sim/actions.ts`'s module header for why their outcome is computed
    // once at start and only applied at expiry.
    activeCommitments: [] as ActiveCommitment[],
    // P3.4 — bounded local-influence accrued per region per party, keyed by `Region.id`. Added to
    // when a targeting commitment starts, subtracted back out when it ends/is cancelled; consumed
    // at the GE by `sim/projection.ts`'s `projectSeatsByParty` overriding the uniform-swing winner
    // wherever one party's net lead clears `LOCAL_INFLUENCE_FLIP_THRESHOLD`.
    localInfluence: {} as Record<string, Record<PartyId, number>>,
    feed: [] as FeedEntry[],
    // Runtime by-election/minor-election vacancies (P2.8, spec §9.5) — generated by
    // `rollByElectionsForDay` each tick rather than pre-authored; see `sim/byElections.ts`.
    contests: [] as Contest[],
    electionOutcomes: [] as ElectionOutcome[],
    campaignObjectives: [] as CampaignObjectiveRecord[],
    campaignArcs: [] as CampaignArcRecord[],
    campaignProjectionCache: null as { key: string; seats: Record<PartyId, number> } | null,
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
        for (const [seatIndex, seat] of region.seats.entries()) {
          const holder = this.currentCommonsSeatHolder(region.id, seatIndex) ?? seat.party
          counts[holder] = (counts[holder] ?? 0) + 1
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
    /** P3.4: also passes accumulated `localInfluence` through to `projectSeatsByParty`, so a seat
     * a party has built a decisive local lead in projects to them regardless of the national
     * uniform-swing winner — this is the "scheduled election consumes accumulated local influence"
     * rule (spec step 3), and it's live throughout play, not just at the GE moment, so the player
     * can see a targeted campaign's effect on the seat projection immediately. */
    projectedCommonsSeatsByParty(state): Record<PartyId, number> {
      const scenario = useScenarioStore()
      return projectSeatsByParty(scenario.commonsRegions, scenario.scenario.polling, state.polling, state.localInfluence)
    },
    projectedPlayerSeatCount(state): number {
      if (!state.selectedPartyId) return 0
      return this.projectedCommonsSeatsByParty[state.selectedPartyId] ?? 0
    },
    latestCommonsElectionOutcome(state): ElectionOutcome | null {
      return [...state.electionOutcomes].reverse().find((outcome) => outcome.tier === 'commons') ?? null
    },
    currentCommonsSeatHolder(state): (regionId: string, seatIndex?: number) => PartyId | undefined {
      return (regionId, seatIndex = 0) => {
        for (let i = state.electionOutcomes.length - 1; i >= 0; i--) {
          const outcome = state.electionOutcomes[i]
          if (outcome.tier !== 'commons' || outcome.status !== 'applied') continue
          const winner = outcome.winners.find((candidate) => candidate.regionId === regionId && candidate.seatIndex === seatIndex)
          if (winner) return winner.winnerParty
        }
        return undefined
      }
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
        return Math.max(0, LEVER_ACTIONS[leverId].cooldownDays - daysBetween(lastUsed, state.date))
      }
    },
    /** Permanent staff capacity (P3.3's "time/turn capacity" sibling resource), base + every
     * completed "staffing" drive's bonus, capped at `STAFF_CAPACITY_MAX`. */
    staffCapacity(state): (partyId: PartyId) => number {
      return (partyId) => Math.min(STAFF_CAPACITY_MAX, STAFF_CAPACITY_BASE + (state.staffCapacityBonus[partyId] ?? 0))
    },
    /** Staff capacity currently held by this party's ongoing commitments — unavailable to any
     * other action until those commitments end or are cancelled. */
    staffHeld(state): (partyId: PartyId) => number {
      return (partyId) => state.activeCommitments.filter((c) => c.partyId === partyId).reduce((sum, c) => sum + c.staffHeld, 0)
    },
    /** Leadership attention currently held by this party's ongoing commitments, out of the fixed
     * `LEADERSHIP_ATTENTION_MAX` pool (P3.3 — no passive regen; see `sim/actions.ts`'s header). */
    leadershipHeld(state): (partyId: PartyId) => number {
      return (partyId) => state.activeCommitments.filter((c) => c.partyId === partyId).reduce((sum, c) => sum + c.leadershipHeld, 0)
    },
    activeCommitmentCount(state): (partyId: PartyId) => number {
      return (partyId) => state.activeCommitments.filter((c) => c.partyId === partyId).length
    },
    /** Assembles one party's `ActionResourceState` snapshot for a given action id — the one place
     * `canTakeAction` gets its inputs from, so a lever and a contest action are validated through
     * the exact same resource math. */
    actionResourceState() {
      return (partyId: PartyId, actionId: string, cooldownDays: number) => {
        const lastUsed = this.leverCooldowns[`${partyId}:${actionId}`]
        const cooldownRemainingDays = lastUsed ? Math.max(0, cooldownDays - daysBetween(lastUsed, this.date)) : 0
        return {
          money: this.finance[partyId]?.estimatedCashOnHand ?? 0,
          staffAvailable: this.staffCapacity(partyId) - this.staffHeld(partyId),
          leadershipAvailable: LEADERSHIP_ATTENTION_MAX - this.leadershipHeld(partyId),
          activeCommitmentCount: this.activeCommitmentCount(partyId),
          cooldownRemainingDays,
          alreadyCommitted: this.activeCommitments.some((c) => c.partyId === partyId && c.actionId === actionId),
        }
      }
    },
    /** Whether the selected party can take a given lever right now, and why not if not. */
    leverAvailability(state): (leverId: LeverId) => ActionAvailability {
      return (leverId) => {
        if (!state.selectedPartyId) return { allowed: false, reason: 'no-party' }
        const def = LEVER_ACTIONS[leverId]
        return canTakeAction(def, this.actionResourceState(state.selectedPartyId, leverId, def.cooldownDays))
      }
    },
    /** Whether the selected party can take a given by-election contest action right now — contest
     * actions are always instant (no cooldown/commitment of their own) so only cost gates them.
     * A free action (`ignore`) needs no party at all, mirroring `actionContest`'s own leniency. */
    contestActionAvailability(state): (actionDef: ContestActionDef) => ActionAvailability {
      return (actionDef) => {
        const hasCost = Object.values(actionDef.cost).some((amount) => (amount ?? 0) > 0)
        if (!hasCost) return { allowed: true }
        if (!state.selectedPartyId) return { allowed: false, reason: 'no-party' }
        return canTakeAction({ cost: actionDef.cost, durationDays: 0 }, this.actionResourceState(state.selectedPartyId, actionDef.id, 0))
      }
    },
    /** Whether `partyId` can launch a targeted campaign at `scope` right now (P3.4) — shared by
     * the player's targeting panel and `runOpponentCadence`, so both go through the exact same
     * cost/cooldown/capacity gate `leverAvailability` uses. */
    targetingAvailability() {
      return (partyId: PartyId, scope: TargetScope): ActionAvailability => {
        if (!partyId) return { allowed: false, reason: 'no-party' }
        const actionId = targetActionId(scope)
        return canTakeAction(TARGETED_CAMPAIGN, this.actionResourceState(partyId, actionId, TARGETED_CAMPAIGN.cooldownDays))
      }
    },
    /** Days left before the selected party can target `scope` again (0 = ready now) — mirrors
     * `leverCooldownRemaining`, keyed by the scope's own namespaced action id instead of a fixed
     * `LeverId` so every scope tracks its cooldown independently. */
    targetingCooldownRemaining(state): (scope: TargetScope) => number {
      return (scope) => {
        if (!state.selectedPartyId) return 0
        const actionId = targetActionId(scope)
        const lastUsed = state.leverCooldowns[`${state.selectedPartyId}:${actionId}`]
        if (!lastUsed) return 0
        return Math.max(0, TARGETED_CAMPAIGN.cooldownDays - daysBetween(lastUsed, state.date))
      }
    },
    /** Every commons region id the selected player has an active targeting commitment covering
     * right now — `runOpponentCadence`'s "respond to player focus" input (spec step 4). */
    playerTargetedRegionIds(state): Set<string> {
      if (!state.selectedPartyId) return new Set()
      const scenario = useScenarioStore()
      const ids = new Set<string>()
      for (const commitment of state.activeCommitments) {
        if (commitment.partyId !== state.selectedPartyId || !commitment.targetScope) continue
        for (const regionId of regionIdsForScope(commitment.targetScope, scenario.scenario.tiers, state.contests)) ids.add(regionId)
      }
      return ids
    },
    /** Every party's accumulated local influence at one region (P3.4) — `{}` if nobody has
     * campaigned there. */
    localInfluenceAt(state): (regionId: string) => Record<PartyId, number> {
      return (regionId) => state.localInfluence[regionId] ?? {}
    },
    /** Every in-flight commitment with a `targetScope` — the map overlay's and targeting panel's
     * "who's campaigning where right now" source. */
    activeTargetingCommitments(state): ActiveCommitment[] {
      return state.activeCommitments.filter((commitment) => commitment.targetScope)
    },
    campaignObjectiveDefinitions(): CampaignObjective[] {
      const scenario = useScenarioStore()
      return flattenObjectives(scenario.scenario.campaign?.primaryObjectives, scenario.scenario.campaign?.optionalObjectives)
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
      this.electionOutcomes = []
      this.campaignArcs = initialiseArcRecords(scenario.scenario.campaign?.arcs ?? [], this.date)
      this.campaignProjectionCache = null
      this.pendingPollImpacts = []
      this.finance = { ...scenario.scenario.finances }
      this.membership = { ...scenario.scenario.membership }
      this.leverCooldowns = {}
      this.staffCapacityBonus = {}
      this.activeCommitments = []
      this.localInfluence = {}
      this.salience = { ...WORLD_SALIENCE }
      this.result = null
      this.playthroughSeed = generatePlaythroughSeed()
      this.campaignObjectives = initialiseObjectiveRecords(this.campaignObjectiveDefinitions, this.objectiveInitialisationContext())
    },
    objectiveInitialisationContext(): ObjectiveEvaluationContext {
      return {
        date: this.date,
        selectedPartyId: this.selectedPartyId,
        polling: this.polling,
        projectedSeatsByParty: {},
        commonsSeatsByParty: {},
        finance: this.finance,
        membership: this.membership,
        feed: this.feed,
        electionOutcomes: this.electionOutcomes,
        campaignArcs: this.campaignArcs,
      }
    },
    objectiveEvaluationContext(): ObjectiveEvaluationContext {
      return {
        date: this.date,
        selectedPartyId: this.selectedPartyId,
        polling: this.polling,
        projectedSeatsByParty: this.cachedProjectedCommonsSeatsByParty(),
        commonsSeatsByParty: this.commonsSeatsByParty,
        finance: this.finance,
        membership: this.membership,
        feed: this.feed,
        electionOutcomes: this.electionOutcomes,
        campaignArcs: this.campaignArcs,
      }
    },
    cachedProjectedCommonsSeatsByParty(): Record<PartyId, number> {
      const key = JSON.stringify([this.polling, this.localInfluence])
      if (this.campaignProjectionCache?.key === key) return this.campaignProjectionCache.seats
      const seats = this.projectedCommonsSeatsByParty
      this.campaignProjectionCache = { key, seats }
      return seats
    },
    evaluateCampaignProgress() {
      const scenario = useScenarioStore()
      const ctx = this.objectiveEvaluationContext()
      this.campaignArcs = evaluateArcAvailability(scenario.scenario.campaign?.arcs ?? [], this.campaignArcs, ctx)
      this.campaignObjectives = evaluateObjectiveRecords(this.campaignObjectiveDefinitions, this.campaignObjectives, {
        ...ctx,
        campaignArcs: this.campaignArcs,
      })
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
      this.advanceCommitments()
      const rolled = rollEventForDay(this.date, this.firedEventIds)
      this.rollByElections()
      this.runOpponentCadence()

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
      const existing = this.electionOutcomes.find((outcome) => outcome.tier === 'commons' && outcome.date === electionDate)
      if (existing) {
        this.result = existing.playerObjective ?? (this.projectedPlayerSeatCount >= this.winThresholdSeats ? 'won' : 'lost')
        this.pauseClock()
        return
      }

      const outcome = resolveCommonsElection({
        date: electionDate,
        regions: scenario.commonsRegions,
        startPolling: scenario.scenario.polling,
        currentPolling: this.polling,
        localInfluenceByRegion: this.localInfluence,
        selectedPartyId: this.selectedPartyId,
        majorityThreshold: this.winThresholdSeats,
      })
      this.applyElectionOutcome(outcome)
      this.pauseClock()
    },
    applyElectionOutcome(outcome: ElectionOutcome) {
      if (this.electionOutcomes.some((existing) => existing.id === outcome.id && existing.status === 'applied')) return
      const applied: ElectionOutcome = { ...outcome, status: 'applied', appliedAt: this.date }
      this.electionOutcomes.push(applied)
      this.result = applied.playerObjective ?? (this.projectedPlayerSeatCount >= this.winThresholdSeats ? 'won' : 'lost')

      const scenario = useScenarioStore()
      const partyName = this.selectedPartyId ? scenario.party(this.selectedPartyId)?.shortName ?? this.selectedPartyId : 'Player party'
      const playerSeats = this.selectedPartyId ? applied.countsByParty[this.selectedPartyId] ?? 0 : 0
      this.recordFeedEntry({
        id: `${applied.id}:applied`,
        date: this.date,
        headline: `General election resolved: ${partyName} wins ${playerSeats} Commons seats.`,
        status: 'actioned',
        effect: applied.provenance,
      })
      this.evaluateCampaignProgress()
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
     * overlay is deferred to P3.5). Shares P3.3's validate -> pay -> resolve pipeline with the
     * levers: a costed action (`local_push`/`nationalise`/`token_effort`) the party can't afford
     * or is otherwise blocked on is silently a no-op, exactly like a denied lever. Updates the
     * matching commons feed entry in place; council contests stay under their weekly grouped
     * entry. */
    actionContest(contestId: string, actionId: ContestActionId) {
      const contest = this.contests.find((candidate) => candidate.id === contestId)
      if (!contest || contest.status === 'resolved') return
      const actionDef = CONTEST_ACTIONS_BY_TIER[contest.contestTier].find((candidate) => candidate.id === actionId)
      if (!actionDef) return

      if (this.selectedPartyId) {
        if (!this.contestActionAvailability(actionDef).allowed) return
        this.payActionCost(this.selectedPartyId, actionDef.cost)
      }

      const { resultLabel, pollingImpacts } = resolveContestAction(contest, actionId, this.selectedPartyId)
      contest.status = 'resolved'
      contest.actionId = actionId
      contest.resultLabel = resultLabel
      this.pendingPollImpacts.push(...pollingImpacts)

      // P3.4: a targeted campaign already running in this contest's region gives the acting
      // party's response a defined, bounded boost — "translate it into contest probability...
      // particularly in P2.8 by-elections" (spec step 3), layered on top of `resolveContestAction`
      // rather than changing that pure function's own odds.
      if (this.selectedPartyId && actionId !== 'ignore') {
        const influence = this.localInfluenceAt(contest.regionId)[this.selectedPartyId] ?? 0
        if (influence > 0) {
          this.pendingPollImpacts.push({
            partyId: this.selectedPartyId,
            magnitude: influence * CONTEST_INFLUENCE_BONUS_FACTOR,
            source: `targeting:contest-bonus:${contest.id}`,
          })
        }
      }

      if (contest.contestTier === 'commons') {
        const entry = this.feed.find((candidate) => candidate.id === contest.id)
        if (entry) {
          entry.status = 'actioned'
          entry.actionTakenId = actionId
          entry.actionTaken = CONTEST_ACTIONS_BY_TIER[contest.contestTier].find((action) => action.id === actionId)?.label
          entry.effect = resultLabel
          entry.actions = undefined
        }
      }
      this.evaluateCampaignProgress()
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
    /** Deducts an action's upfront `cost.money` from a party's finance — the only part of a cost
     * that's ever permanently spent immediately; `staff`/`leadership` are either a momentary
     * eligibility gate (instant actions) or held by an `ActiveCommitment` until it ends (see
     * `@/types/action.ts`'s `ActionCost` header). Never called without `canTakeAction` having
     * just allowed the same action — components request an action by id, never a raw delta. */
    payActionCost(partyId: PartyId, cost: ActionCost) {
      if (!cost.money) return
      const current = this.finance[partyId]
      this.finance[partyId] = { ...current, estimatedCashOnHand: (current?.estimatedCashOnHand ?? 0) - cost.money, source: 'estimated' }
    },
    /** Applies a resolved (instant or just-expired) action's typed effects to a party's live
     * state — the one place an `ActionOutcome` ever turns into a state mutation, shared by
     * `runLeverAction`'s instant path and `advanceCommitments`'s expiry path. */
    applyInstantOutcome(partyId: PartyId, outcome: ActionOutcome) {
      if (outcome.financeDelta) {
        const current = this.finance[partyId]
        this.finance[partyId] = { ...current, estimatedCashOnHand: (current?.estimatedCashOnHand ?? 0) + outcome.financeDelta, source: 'estimated' }
      }
      if (outcome.membershipDelta) {
        this.membership[partyId] = (this.membership[partyId] ?? 0) + outcome.membershipDelta
      }
      if (outcome.pollingImpacts.length) {
        this.pendingPollImpacts.push(...outcome.pollingImpacts)
      }
      if (outcome.staffCapacityBonus) {
        this.staffCapacityBonus[partyId] = (this.staffCapacityBonus[partyId] ?? 0) + outcome.staffCapacityBonus
      }
    },
    /** The one entry point every lever (P2.9, spec §9.3) goes through (P3.3's shared design
     * boundary): validate -> pay -> resolve -> record, identically whether the lever resolves
     * instantly or becomes a multi-day `ActiveCommitment`. Silently a no-op if `leverAvailability`
     * denies it — components surface the denial reason themselves before ever calling this. */
    runLeverAction(leverId: LeverId) {
      const partyId = this.selectedPartyId
      if (!partyId || !this.leverAvailability(leverId).allowed) return

      const def = LEVER_ACTIONS[leverId]
      this.payActionCost(partyId, def.cost)
      const outcome = resolveLeverAction(leverId, partyId, this.date)
      this.leverCooldowns[`${partyId}:${leverId}`] = this.date
      const scenario = useScenarioStore()
      const partyName = scenario.party(partyId)?.shortName ?? partyId

      if (def.durationDays > 0) {
        this.activeCommitments.push(buildCommitment(leverId, partyId, this.date, def, outcome))
        this.recordFeedEntry({
          id: `lever:${leverId}:${this.date}`,
          date: this.date,
          headline: `${partyName} begins: ${def.label.toLowerCase()}.`,
          status: 'actioned',
        })
        this.evaluateCampaignProgress()
        return
      }

      this.applyInstantOutcome(partyId, outcome)
      this.recordFeedEntry({
        id: `lever:${leverId}:${this.date}`,
        date: this.date,
        headline: `${partyName} ${outcome.resultLabel}`,
        status: 'actioned',
      })
      this.evaluateCampaignProgress()
    },
    /** Adds `magnitude` (negative to reverse) to every region in `scope`'s `localInfluence`,
     * clamped to the bounded range a single campaign can ever swing a region by (P3.4 step 3 —
     * stacking moves it further but never past the cap). A no-op for 'national' scope, which has
     * no regions to apply to. */
    applyLocalInfluence(scope: TargetScope, partyId: PartyId, magnitude: number) {
      if (!magnitude) return
      const scenario = useScenarioStore()
      for (const regionId of regionIdsForScope(scope, scenario.scenario.tiers, this.contests)) {
        const forRegion = { ...(this.localInfluence[regionId] ?? {}) }
        forRegion[partyId] = clampLocalInfluence((forRegion[partyId] ?? 0) + magnitude)
        this.localInfluence[regionId] = forRegion
      }
    },
    /** The one entry point every targeted campaign (P3.4 step 3) goes through — player or
     * opponent alike, mirroring `runLeverAction`'s validate -> pay -> resolve -> record pipeline.
     * `rationale`, when given, is an AI move's recorded justification (spec step 4: "record
     * public-facing summaries"); omitted for the player's own choices, which need no justifying. */
    runTargetingAction(partyId: PartyId, scope: TargetScope, rationale?: string) {
      if (!this.targetingAvailability(partyId, scope).allowed) return

      this.payActionCost(partyId, TARGETED_CAMPAIGN.cost)
      const outcome = resolveTargetingAction(scope, partyId, this.date)
      const actionId = targetActionId(scope)
      this.leverCooldowns[`${partyId}:${actionId}`] = this.date

      const commitment = buildCommitment(actionId, partyId, this.date, TARGETED_CAMPAIGN, outcome)
      this.activeCommitments.push(commitment)
      if (commitment.localInfluenceMagnitude) this.applyLocalInfluence(scope, partyId, commitment.localInfluenceMagnitude)

      const scenario = useScenarioStore()
      const partyName = scenario.party(partyId)?.shortName ?? partyId
      this.recordFeedEntry({
        id: `${actionId}:${this.date}`,
        date: this.date,
        headline: rationale ? `${partyName}: ${rationale}` : `${partyName} launches a targeted campaign in ${scope.label}.`,
        status: 'actioned',
      })
    },
    /** Every eligible non-player party's deterministic targeting move for today (P3.4 step 4),
     * run on a fixed cadence (`OPPONENT_CADENCE_DAYS`) so this isn't re-evaluated every single
     * day. Eligibility excludes anyone the player can't themselves play (`scope: 'local'` —
     * speaker/independents/crossbench/bishops) and the player's own party. Each party takes at
     * most one move per cadence tick, and only if it can actually afford `TARGETED_CAMPAIGN`
     * through the same `targetingAvailability` gate the player is held to — an unaffordable party
     * simply sits this tick out. */
    runOpponentCadence() {
      const scenario = useScenarioStore()
      if (!isOpponentCadenceDay(scenario.scenario.date, this.date)) return

      const commonsRegions = scenario.commonsRegions
      const playerRegionIds = this.playerTargetedRegionIds
      for (const party of scenario.scenario.parties) {
        if (party.scope === 'local' || party.id === this.selectedPartyId) continue
        const candidates = rankTargetingMoves(party.id, commonsRegions, playerRegionIds)
        const move = selectOpponentMove(candidates, (scope) => this.targetingAvailability(party.id, scope).allowed)
        if (move) this.runTargetingAction(party.id, move.scope, move.rationale)
      }
    },
    /** Cancels an in-flight commitment early — the held staff/leadership is released back
     * immediately (it's simply no longer summed by `staffHeld`/`leadershipHeld` once removed from
     * `activeCommitments`), but the upfront cost already paid is forfeit and the commitment's
     * outcome never applies. That forfeiture *is* P3.3's "cancellation cost": there's no separate
     * penalty to invent on top of the sunk spend. */
    cancelCommitment(commitmentId: string) {
      const index = this.activeCommitments.findIndex((commitment) => commitment.id === commitmentId)
      if (index < 0) return
      const [commitment] = this.activeCommitments.splice(index, 1)
      if (commitment.targetScope && commitment.localInfluenceMagnitude) {
        this.applyLocalInfluence(commitment.targetScope, commitment.partyId, -commitment.localInfluenceMagnitude)
      }
      const scenario = useScenarioStore()
      const partyName = scenario.party(commitment.partyId)?.shortName ?? commitment.partyId
      const label = commitment.targetScope ? TARGETED_CAMPAIGN.label : LEVER_ACTIONS[commitment.actionId as LeverId]?.label ?? commitment.actionId
      this.recordFeedEntry({
        id: `${commitment.id}:cancelled`,
        date: this.date,
        headline: `${partyName} abandons: ${label.toLowerCase()}.`,
        status: 'actioned',
      })
    },
    /** Advances every ongoing commitment by one day (P3.3 step 4): charges today's recurring
     * costs, then applies each just-expired commitment's outcome (computed once, back when it
     * started) and records it in the feed. Delegates the actual advance/expiry/cost-summing to
     * the pure `advanceCommitmentsForDay` so the ordering is deterministic regardless of insertion
     * order. */
    advanceCommitments() {
      const { stillActive, expired, recurringMoneyCostsByParty } = advanceCommitmentsForDay(this.activeCommitments, this.date)
      this.activeCommitments = stillActive

      for (const [partyId, cost] of Object.entries(recurringMoneyCostsByParty)) {
        const current = this.finance[partyId]
        this.finance[partyId] = { ...current, estimatedCashOnHand: (current?.estimatedCashOnHand ?? 0) - cost, source: 'estimated' }
      }

      const scenario = useScenarioStore()
      for (const commitment of expired) {
        if (commitment.targetScope && commitment.localInfluenceMagnitude) {
          this.applyLocalInfluence(commitment.targetScope, commitment.partyId, -commitment.localInfluenceMagnitude)
        }
        this.applyInstantOutcome(commitment.partyId, {
          pollingImpacts: commitment.pollingImpacts,
          financeDelta: commitment.financeDelta,
          membershipDelta: commitment.membershipDelta,
          staffCapacityBonus: commitment.staffCapacityBonus,
          resultLabel: commitment.resultLabel,
        })
        const partyName = scenario.party(commitment.partyId)?.shortName ?? commitment.partyId
        this.recordFeedEntry({
          id: `${commitment.id}:resolved`,
          date: this.date,
          headline: `${partyName} ${commitment.resultLabel}`,
          status: 'actioned',
        })
      }
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
      entry.actionTakenId = action.id
      entry.actionTaken = action.label
      entry.effect = [action.effects?.summary, ...summary].filter(Boolean).join(' ') || undefined
      entry.actions = undefined

      const scenario = useScenarioStore()
      const beforeConsequences = new Set(this.campaignArcs.flatMap((record) => record.consequences.map((consequence) => consequence.id)))
      this.campaignArcs = applyArcChoice(scenario.scenario.campaign?.arcs ?? [], this.campaignArcs, event.id, action.id, this.date)
      for (const record of this.campaignArcs) {
        const latest = record.consequences.find((consequence) => !beforeConsequences.has(consequence.id))
        if (!latest) continue
        this.recordFeedEntry({
          id: `arc:${record.arcId}:${latest.id}:${this.date}`,
          date: this.date,
          headline: latest.label,
          status: 'actioned',
          effect: latest.summary,
        })
      }
      this.evaluateCampaignProgress()

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
        staffCapacityBonus: { ...this.staffCapacityBonus },
        activeCommitments: this.activeCommitments.map((commitment) => ({
          ...commitment,
          pollingImpacts: commitment.pollingImpacts.map((impact) => ({ ...impact })),
        })),
        localInfluence: Object.fromEntries(Object.entries(this.localInfluence).map(([regionId, byParty]) => [regionId, { ...byParty }])),
        feed: this.feed.map((entry) => ({ ...entry, actions: entry.actions?.map((action) => ({ ...action })) })),
        contests: this.contests.map((contest) => ({ ...contest })),
        electionOutcomes: this.electionOutcomes.map((outcome) => ({
          ...outcome,
          winners: outcome.winners.map((winner) => ({ ...winner })),
          decisiveSeats: outcome.decisiveSeats.map((winner) => ({ ...winner })),
          countsByParty: { ...outcome.countsByParty },
          changesByParty: { ...outcome.changesByParty },
        })),
        campaignObjectives: this.campaignObjectives.map((record) => ({ ...record })),
        campaignArcs: this.campaignArcs.map((record) => ({
          ...record,
          consequences: record.consequences.map((consequence) => ({ ...consequence })),
        })),
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
      const knownRepresentationPartyIds = new Set(knownPartyIds)
      for (const region of scenario.commonsRegions) {
        for (const seat of region.seats) {
          knownRepresentationPartyIds.add(seat.party)
          for (const result of seat.results ?? []) knownRepresentationPartyIds.add(result.party)
        }
      }

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
      this.staffCapacityBonus = pickKnownParties(state.staffCapacityBonus, knownPartyIds)
      this.activeCommitments = pickKnownCommitments(state.activeCommitments, knownPartyIds).map((commitment) => ({
        ...commitment,
        pollingImpacts: commitment.pollingImpacts.map((impact) => ({ ...impact })),
      }))
      this.localInfluence = Object.fromEntries(
        Object.entries(state.localInfluence ?? {}).map(([regionId, byParty]) => [regionId, pickKnownParties(byParty, knownPartyIds)]),
      )
      this.campaignProjectionCache = null
      this.feed = state.feed.map((entry) => ({ ...entry, actions: entry.actions?.map((action) => ({ ...action })) }))
      this.contests = state.contests
        .filter((contest) => isKnownContest(contest, knownPartyIds, commonsRegionIds, councilWardRegionIds))
        .map((contest) => ({ ...contest }))
      this.electionOutcomes = (state.electionOutcomes ?? [])
        .filter((outcome) => isKnownElectionOutcome(outcome, knownRepresentationPartyIds, commonsRegionIds))
        .map((outcome) => ({
          ...outcome,
          winners: outcome.winners.map((winner) => ({ ...winner })),
          decisiveSeats: outcome.decisiveSeats.map((winner) => ({ ...winner })),
          countsByParty: pickKnownParties(outcome.countsByParty, knownRepresentationPartyIds),
          changesByParty: pickKnownParties(outcome.changesByParty, knownRepresentationPartyIds),
        }))
      const knownCampaignArcIds = new Set((scenario.scenario.campaign?.arcs ?? []).map((arc) => arc.id))
      const knownCampaignObjectiveIds = new Set(this.campaignObjectiveDefinitions.map((objective) => objective.id))
      this.campaignArcs = (state.campaignArcs ?? initialiseArcRecords(scenario.scenario.campaign?.arcs ?? [], state.date))
        .filter((record) => knownCampaignArcIds.has(record.arcId))
        .map((record) => ({
          ...record,
          consequences: record.consequences.map((consequence) => ({ ...consequence })),
        }))
      this.campaignObjectives = (state.campaignObjectives ?? initialiseObjectiveRecords(this.campaignObjectiveDefinitions, this.objectiveEvaluationContext()))
        .filter((record) => knownCampaignObjectiveIds.has(record.objectiveId))
        .map((record) => ({ ...record }))
      this.pendingEvents = state.pendingEventIds
        .map((id) => EVENT_POOL.find((event) => event.id === id))
        .filter((event): event is GameEvent => !!event)
      this.firedEventIds = [...state.firedEventIds]
      this.salience = { ...WORLD_SALIENCE, ...state.salience }
      this.result = state.result
    },
  },
})
