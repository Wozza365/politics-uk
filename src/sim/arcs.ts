import type { CampaignArc, CampaignArcRecord, ISODate } from '@/types'
import type { ObjectiveEvaluationContext } from './objectives'
import { conditionMet } from './objectives'

export function initialiseArcRecords(arcs: CampaignArc[], date: ISODate): CampaignArcRecord[] {
  return arcs.map((arc) => ({
    arcId: arc.id,
    status: 'available',
    currentStageId: arc.startsAtStageId,
    startedAt: date,
    updatedAt: date,
    consequences: [],
  }))
}

export function evaluateArcAvailability(arcs: CampaignArc[], records: CampaignArcRecord[], ctx: ObjectiveEvaluationContext): CampaignArcRecord[] {
  return records.map((record) => {
    if (record.status !== 'available') return record
    const arc = arcs.find((candidate) => candidate.id === record.arcId)
    const stage = arc?.stages.find((candidate) => candidate.id === record.currentStageId)
    if (!stage || !stage.prerequisites?.length || stage.prerequisites.every((condition) => conditionMet(condition, ctx))) {
      return { ...record, status: 'active', updatedAt: ctx.date }
    }
    return record
  })
}

export function applyArcChoice(arcs: CampaignArc[], records: CampaignArcRecord[], eventId: string, actionId: string, date: ISODate): CampaignArcRecord[] {
  return records.map((record) => {
    if (record.status !== 'active') return record
    const arc = arcs.find((candidate) => candidate.id === record.arcId)
    const stage = arc?.stages.find((candidate) => candidate.id === record.currentStageId)
    const branch = stage?.branches.find((candidate) => candidate.eventId === eventId && candidate.actionId === actionId)
    if (!branch) return record

    const closes = branch.closesArc || !branch.nextStageId
    return {
      ...record,
      status: closes ? 'completed' : 'active',
      currentStageId: branch.nextStageId ?? record.currentStageId,
      updatedAt: date,
      completedAt: closes ? date : record.completedAt,
      consequences: [...record.consequences, branch.consequence],
    }
  })
}
