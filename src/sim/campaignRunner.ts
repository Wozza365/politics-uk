import { createPinia, setActivePinia } from 'pinia'
import type { ContestActionId, ISODate, LeverId, PartyId, TargetScope } from '@/types'
import type { PollingImpact } from './poll'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import { computeDifficulty, type DifficultyBand } from './difficulty'

export type CampaignRunnerAction =
  | { day: number; kind: 'lever'; leverId: LeverId }
  | { day: number; kind: 'target'; partyId?: PartyId; scope: TargetScope }
  | { day: number; kind: 'contest'; actionId: ContestActionId; contestId?: string; tier?: 'commons' | 'council' }
  | { day: number; kind: 'eventChoice'; choiceId?: string }
  | { day: number; kind: 'saveRestore' }
  | { day: number; kind: 'continuePlaying' }

export interface CampaignRunnerOptions {
  partyId: PartyId
  days: number
  playthroughSeed?: number
  actions?: CampaignRunnerAction[]
  extraDailyImpacts?: Record<number, PollingImpact[]>
  autoResolvePendingEvents?: 'first' | 'last' | 'none'
  throwOnInvariantFailure?: boolean
}

export interface BalanceIndicators {
  minCashByParty: Record<PartyId, number>
  maxCashByParty: Record<PartyId, number>
  actionAvailability: Record<string, number>
  pollingRangeByParty: Record<PartyId, { min: number; max: number }>
  contestWinRate: { resolved: number; playerWins: number; rate: number | null }
  electionOutcomes: number
  objectiveCompletion: { complete: number; failed: number; active: number }
  saveRestoreChecks: { attempted: number; matched: number }
}

export interface CampaignOutcomeReport {
  scenarioId: string
  partyId: PartyId
  difficulty: DifficultyBand
  startDate: ISODate
  endDate: ISODate
  daysElapsed: number
  result: 'won' | 'lost' | null
  polling: Record<PartyId, number>
  projectedSeats: Record<PartyId, number>
  commonsSeats: Record<PartyId, number>
  feedEntries: number
  pendingEvents: number
  activeCommitments: number
  contests: { pending: number; resolved: number }
  indicators: BalanceIndicators
  invariantFailures: string[]
  deterministicHash: string
}

interface DailySample {
  polling: Record<PartyId, number>
  cash: Record<PartyId, number>
  actionAvailability: Record<string, boolean>
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function stableHash(value: unknown): string {
  const text = stableStringify(value)
  let hash = 5381
  for (let index = 0; index < text.length; index++) hash = (hash * 33) ^ text.charCodeAt(index)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function sampleDay(game: ReturnType<typeof useGameStore>, scenario: ReturnType<typeof useScenarioStore>): DailySample {
  const actionAvailability: Record<string, boolean> = {}
  for (const leverId of ['fundraising', 'socialMedia', 'policy', 'staffing', 'campaigning', 'leadership'] as LeverId[]) {
    actionAvailability[`lever:${leverId}`] = game.leverAvailability(leverId).allowed
  }
  return {
    polling: { ...game.polling },
    cash: Object.fromEntries(scenario.scenario.parties.map((party) => [party.id, game.finance[party.id]?.estimatedCashOnHand ?? 0])),
    actionAvailability,
  }
}

function resolvePendingEvent(game: ReturnType<typeof useGameStore>, mode: 'first' | 'last' | 'none') {
  if (mode === 'none') return
  const event = game.pendingEvents[0]
  const choices = event?.actions ?? []
  const choice = mode === 'last' ? choices.at(-1) : choices[0]
  if (choice) game.resolvePendingEvent(choice.id)
}

function executeAction(
  action: CampaignRunnerAction,
  game: ReturnType<typeof useGameStore>,
): { game?: ReturnType<typeof useGameStore>; saveRestoreMatched?: boolean } {
  switch (action.kind) {
    case 'lever':
      game.runLeverAction(action.leverId)
      return {}
    case 'target':
      game.runTargetingAction(action.partyId ?? game.selectedPartyId ?? '', action.scope)
      return {}
    case 'contest': {
      const contest = game.contests.find(
        (candidate) => candidate.status === 'pending' && (!action.contestId || candidate.id === action.contestId) && (!action.tier || candidate.contestTier === action.tier),
      )
      if (contest) game.actionContest(contest.id, action.actionId)
      return {}
    }
    case 'eventChoice': {
      const event = game.pendingEvents[0]
      const choice = action.choiceId ? event?.actions?.find((candidate) => candidate.id === action.choiceId) : event?.actions?.[0]
      if (choice) game.resolvePendingEvent(choice.id)
      return {}
    }
    case 'continuePlaying':
      game.continuePlaying()
      return {}
    case 'saveRestore': {
      const before = compactStateSummary(game)
      const snapshot = game.toSaveState()
      const seed = game.playthroughSeed
      setActivePinia(createPinia())
      const restoredGame = useGameStore()
      useScenarioStore()
      restoredGame.hydrateFromSaveState(snapshot)
      restoredGame.playthroughSeed = seed
      return {
        game: restoredGame,
        saveRestoreMatched: stableStringify(before) === stableStringify(compactStateSummary(restoredGame)),
      }
    }
  }
}

function compactStateSummary(game: ReturnType<typeof useGameStore>) {
  return {
    date: game.date,
    polling: game.polling,
    finance: game.finance,
    membership: game.membership,
    activeCommitments: game.activeCommitments,
    localInfluence: game.localInfluence,
    contests: game.contests,
    electionOutcomes: game.electionOutcomes,
    campaignObjectives: game.campaignObjectives,
    campaignArcs: game.campaignArcs,
    pendingEventIds: game.pendingEvents.map((event) => event.id),
    firedEventIds: game.firedEventIds,
    result: game.result,
  }
}

function buildIndicators(
  game: ReturnType<typeof useGameStore>,
  scenario: ReturnType<typeof useScenarioStore>,
  samples: DailySample[],
  saveRestoreChecks: { attempted: number; matched: number },
): BalanceIndicators {
  const minCashByParty: Record<PartyId, number> = {}
  const maxCashByParty: Record<PartyId, number> = {}
  const pollingRangeByParty: Record<PartyId, { min: number; max: number }> = {}
  const actionAvailability: Record<string, number> = {}

  for (const party of scenario.scenario.parties) {
    const cashValues = samples.map((sample) => sample.cash[party.id] ?? 0)
    const pollingValues = samples.map((sample) => sample.polling[party.id] ?? 0)
    minCashByParty[party.id] = Math.min(...cashValues)
    maxCashByParty[party.id] = Math.max(...cashValues)
    pollingRangeByParty[party.id] = { min: Math.min(...pollingValues), max: Math.max(...pollingValues) }
  }
  for (const sample of samples) {
    for (const [key, allowed] of Object.entries(sample.actionAvailability)) {
      if (allowed) actionAvailability[key] = (actionAvailability[key] ?? 0) + 1
    }
  }

  const resolvedContests = game.contests.filter((contest) => contest.status === 'resolved')
  const playerWins = resolvedContests.filter((contest) => contest.resultLabel?.startsWith(`${game.selectedPartyId} gain`)).length
  const objectiveCounts = { complete: 0, failed: 0, active: 0 }
  for (const objective of game.campaignObjectives) {
    if (objective.status === 'succeeded') objectiveCounts.complete++
    else if (objective.status === 'failed' || objective.status === 'expired') objectiveCounts.failed++
    else objectiveCounts.active++
  }

  return {
    minCashByParty,
    maxCashByParty,
    actionAvailability,
    pollingRangeByParty,
    contestWinRate: { resolved: resolvedContests.length, playerWins, rate: resolvedContests.length ? playerWins / resolvedContests.length : null },
    electionOutcomes: game.electionOutcomes.length,
    objectiveCompletion: objectiveCounts,
    saveRestoreChecks,
  }
}

function invariantFailures(game: ReturnType<typeof useGameStore>, scenario: ReturnType<typeof useScenarioStore>): string[] {
  const failures: string[] = []
  const partyIds = new Set(scenario.scenario.parties.map((party) => party.id))
  const representationPartyIds = new Set(partyIds)
  for (const region of scenario.commonsRegions) {
    for (const seat of region.seats) {
      representationPartyIds.add(seat.party)
      for (const result of seat.results ?? []) representationPartyIds.add(result.party)
    }
  }
  const commonsRegionIds = new Set(scenario.commonsRegions.map((region) => region.id))
  const totalPolling = Object.values(game.polling).reduce((sum, value) => sum + value, 0)
  const expectedPollingTotal = Object.values(scenario.scenario.polling).reduce((sum, value) => sum + value, 0)
  const commonsSeatTotal = Object.values(game.commonsSeatsByParty).reduce((sum, value) => sum + value, 0)

  const lowerPollingBound = Math.max(0, expectedPollingTotal - 5)
  const upperPollingBound = Math.min(101, expectedPollingTotal + 5)
  if (totalPolling < lowerPollingBound || totalPolling > upperPollingBound) {
    failures.push(`Polling totals ${totalPolling.toFixed(2)}, expected ${lowerPollingBound.toFixed(2)}-${upperPollingBound.toFixed(2)}.`)
  }
  if (commonsSeatTotal !== scenario.commonsRegions.length) failures.push(`Commons seats reconcile to ${commonsSeatTotal}, expected ${scenario.commonsRegions.length}.`)

  for (const [partyId, finance] of Object.entries(game.finance)) {
    if (!partyIds.has(partyId)) failures.push(`Finance references unknown party ${partyId}.`)
    if (!Number.isFinite(finance.estimatedCashOnHand)) failures.push(`Finance for ${partyId} is not finite.`)
    if ((finance.estimatedCashOnHand ?? 0) < -250_000) failures.push(`Finance for ${partyId} is below the solvency floor.`)
  }
  for (const [partyId, value] of Object.entries(game.polling)) {
    if (!partyIds.has(partyId)) failures.push(`Polling references unknown party ${partyId}.`)
    if (value < 0 || value > 100) failures.push(`Polling for ${partyId} is outside 0-100.`)
  }
  for (const commitment of game.activeCommitments) {
    if (!partyIds.has(commitment.partyId)) failures.push(`Commitment ${commitment.id} references unknown party ${commitment.partyId}.`)
    if (commitment.endsDate < game.date) failures.push(`Commitment ${commitment.id} did not expire by ${game.date}.`)
  }
  for (const contest of game.contests) {
    if (!partyIds.has(contest.incumbentParty)) failures.push(`Contest ${contest.id} references unknown incumbent ${contest.incumbentParty}.`)
  }
  for (const outcome of game.electionOutcomes) {
    if (outcome.winners.length !== outcome.eligibleSeatCount) failures.push(`Election ${outcome.id} winner count does not match eligible seats.`)
    for (const winner of outcome.winners) {
      if (!commonsRegionIds.has(winner.regionId)) failures.push(`Election ${outcome.id} references unknown Commons region ${winner.regionId}.`)
      if (!representationPartyIds.has(winner.winnerParty)) failures.push(`Election ${outcome.id} references unknown winner ${winner.winnerParty}.`)
    }
  }

  return failures
}

export function runHeadlessCampaign(options: CampaignRunnerOptions): CampaignOutcomeReport {
  setActivePinia(createPinia())
  const scenario = useScenarioStore()
  let game = useGameStore()
  game.startGame(options.partyId)
  if (options.playthroughSeed !== undefined) game.playthroughSeed = options.playthroughSeed

  const startDate = game.date
  const sortedActions = [...(options.actions ?? [])].sort((a, b) => a.day - b.day)
  const samples: DailySample[] = [sampleDay(game, scenario)]
  const saveRestoreChecks = { attempted: 0, matched: 0 }

  for (let day = 1; day <= options.days; day++) {
    game.tickDay(options.extraDailyImpacts?.[day] ?? [])
    for (const action of sortedActions.filter((candidate) => candidate.day === day)) {
      const result = executeAction(action, game)
      if (result.game) game = result.game
      if (result.saveRestoreMatched !== undefined) {
        saveRestoreChecks.attempted++
        if (result.saveRestoreMatched) saveRestoreChecks.matched++
      }
    }
    resolvePendingEvent(game, options.autoResolvePendingEvents ?? 'first')
    if (game.result) game.continuePlaying()
    samples.push(sampleDay(game, scenario))
  }

  const selectedParty = scenario.party(options.partyId)
  const reportBase = {
    scenarioId: scenario.scenario.id,
    partyId: options.partyId,
    difficulty: selectedParty ? computeDifficulty(selectedParty, scenario.scenario) : 5,
    startDate,
    endDate: game.date,
    daysElapsed: options.days,
    result: game.result,
    polling: { ...game.polling },
    projectedSeats: game.projectedCommonsSeatsByParty,
    commonsSeats: game.commonsSeatsByParty,
    feedEntries: game.feed.length,
    pendingEvents: game.pendingEvents.length,
    activeCommitments: game.activeCommitments.length,
    contests: {
      pending: game.contests.filter((contest) => contest.status === 'pending').length,
      resolved: game.contests.filter((contest) => contest.status === 'resolved').length,
    },
    indicators: buildIndicators(game, scenario, samples, saveRestoreChecks),
    invariantFailures: invariantFailures(game, scenario),
  }
  const report: CampaignOutcomeReport = {
    ...reportBase,
    deterministicHash: stableHash(reportBase),
  }
  if (options.throwOnInvariantFailure && report.invariantFailures.length) {
    throw new Error(`Campaign invariants failed:\n${report.invariantFailures.join('\n')}`)
  }
  return report
}

export function runCampaignBatch(options: Omit<CampaignRunnerOptions, 'partyId'> & { partyIds: PartyId[] }): CampaignOutcomeReport[] {
  return options.partyIds.map((partyId) => runHeadlessCampaign({ ...options, partyId }))
}
