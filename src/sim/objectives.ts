import type { CampaignArcRecord, CampaignCondition, CampaignObjective, CampaignObjectiveRecord, ElectionOutcome, FeedEntry, ISODate, PartyFinance, PartyId } from '@/types'

export interface ObjectiveEvaluationContext {
  date: ISODate
  selectedPartyId: PartyId | null
  polling: Record<PartyId, number>
  projectedSeatsByParty: Record<PartyId, number>
  commonsSeatsByParty: Record<PartyId, number>
  finance: Record<PartyId, PartyFinance>
  membership: Record<PartyId, number>
  feed: FeedEntry[]
  electionOutcomes: ElectionOutcome[]
  campaignArcs: CampaignArcRecord[]
}

function resolvePartyId(partyId: PartyId | 'player', ctx: ObjectiveEvaluationContext): PartyId | null {
  return partyId === 'player' ? ctx.selectedPartyId : partyId
}

export function conditionMet(condition: CampaignCondition, ctx: ObjectiveEvaluationContext): boolean {
  switch (condition.type) {
    case 'date-on-or-after':
      return ctx.date >= condition.date
    case 'date-on-or-before':
      return ctx.date <= condition.date
    case 'polling-at-least': {
      const partyId = resolvePartyId(condition.partyId, ctx)
      return partyId ? (ctx.polling[partyId] ?? 0) >= condition.value : false
    }
    case 'polling-below': {
      const partyId = resolvePartyId(condition.partyId, ctx)
      return partyId ? (ctx.polling[partyId] ?? 0) < condition.value : false
    }
    case 'projected-seats-at-least': {
      const partyId = resolvePartyId(condition.partyId, ctx)
      return partyId ? (ctx.projectedSeatsByParty[partyId] ?? 0) >= condition.value : false
    }
    case 'commons-seats-at-least': {
      const partyId = resolvePartyId(condition.partyId, ctx)
      return partyId ? (ctx.commonsSeatsByParty[partyId] ?? 0) >= condition.value : false
    }
    case 'cash-at-least': {
      const partyId = resolvePartyId(condition.partyId, ctx)
      return partyId ? (ctx.finance[partyId]?.estimatedCashOnHand ?? 0) >= condition.value : false
    }
    case 'membership-at-least': {
      const partyId = resolvePartyId(condition.partyId, ctx)
      return partyId ? (ctx.membership[partyId] ?? 0) >= condition.value : false
    }
    case 'action-taken':
      return ctx.feed.some((entry) => entry.id.includes(`:${condition.actionId}:`) || entry.actionTakenId === condition.actionId)
    case 'event-action-taken':
      return ctx.feed.some((entry) => entry.id === condition.eventId && entry.actionTakenId === condition.actionId)
    case 'arc-consequence':
      return ctx.campaignArcs.some((arc) => arc.consequences.some((consequence) => consequence.id === condition.consequenceId))
    case 'election-outcome':
      return ctx.electionOutcomes.some((outcome) => outcome.tier === condition.tier && outcome.playerObjective === condition.result)
  }
}

function allConditionsMet(conditions: CampaignCondition[] | undefined, ctx: ObjectiveEvaluationContext): boolean {
  return !conditions?.length || conditions.every((condition) => conditionMet(condition, ctx))
}

export function flattenObjectives(primary: CampaignObjective[] = [], optional: CampaignObjective[] = []): CampaignObjective[] {
  return [...primary, ...optional]
}

export function initialiseObjectiveRecords(objectives: CampaignObjective[], ctx: ObjectiveEvaluationContext): CampaignObjectiveRecord[] {
  return objectives
    .filter((objective) => !objective.partyIds?.length || (ctx.selectedPartyId ? objective.partyIds.includes(ctx.selectedPartyId) : false))
    .map((objective) => {
      const hiddenSatisfied = allConditionsMet(objective.hiddenUntil, ctx)
      const available = objective.kind !== 'hidden' || hiddenSatisfied
      const active = available && (!objective.activeFrom || ctx.date >= objective.activeFrom) && objective.kind !== 'historical'
      return {
        objectiveId: objective.id,
        status: active ? 'active' : available ? 'available' : 'available',
        availableAt: available ? ctx.date : undefined,
        activeAt: active ? ctx.date : undefined,
      }
    })
}

export function evaluateObjectiveRecords(
  objectives: CampaignObjective[],
  records: CampaignObjectiveRecord[],
  ctx: ObjectiveEvaluationContext,
): CampaignObjectiveRecord[] {
  const byId = new Map(records.map((record) => [record.objectiveId, { ...record }]))
  const next = initialiseObjectiveRecords(objectives, ctx).map((initial) => ({ ...initial, ...byId.get(initial.objectiveId) }))

  for (const record of next) {
    const objective = objectives.find((candidate) => candidate.id === record.objectiveId)
    if (!objective || ['succeeded', 'failed', 'expired'].includes(record.status)) continue

    if (objective.kind === 'hidden' && !record.availableAt && allConditionsMet(objective.hiddenUntil, ctx)) {
      record.availableAt = ctx.date
      record.status = 'available'
    }
    if (record.status === 'available' && (!objective.activeFrom || ctx.date >= objective.activeFrom)) {
      record.status = objective.kind === 'historical' ? 'available' : 'active'
      record.activeAt = ctx.date
    }
    if (record.status !== 'active') continue

    if (allConditionsMet(objective.success, ctx)) {
      record.status = 'succeeded'
      record.completedAt = ctx.date
      record.reason = 'success'
    } else if (objective.failure?.length && allConditionsMet(objective.failure, ctx)) {
      record.status = 'failed'
      record.completedAt = ctx.date
      record.reason = 'failure'
    } else if (objective.expiresOn && ctx.date > objective.expiresOn) {
      record.status = 'expired'
      record.completedAt = ctx.date
      record.reason = 'expired'
    }
  }

  return next
}
