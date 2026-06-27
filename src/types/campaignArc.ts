import type { ISODate } from './party'
import type { CampaignCondition } from './objective'

export interface CampaignArcConsequence {
  id: string
  label: string
  summary: string
}

export interface CampaignArcBranch {
  eventId: string
  actionId: string
  nextStageId?: string
  closesArc?: boolean
  consequence: CampaignArcConsequence
}

export interface CampaignArcStage {
  id: string
  title: string
  summary: string
  prerequisites?: CampaignCondition[]
  branches: CampaignArcBranch[]
}

export interface CampaignArc {
  id: string
  title: string
  description: string
  startsAtStageId: string
  oneShot?: boolean
  cooldownDays?: number
  stages: CampaignArcStage[]
}

export interface CampaignArcRecord {
  arcId: string
  status: 'available' | 'active' | 'completed' | 'closed'
  currentStageId: string
  startedAt: ISODate
  updatedAt: ISODate
  completedAt?: ISODate
  consequences: CampaignArcConsequence[]
}
