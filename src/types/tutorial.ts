import type { ISODate, PartyId } from './party'

export type TutorialMilestoneId =
  | 'campaign-start'
  | 'first-player-lever'
  | 'first-paused-action-event'
  | 'first-contest'
  | 'first-targeted-commitment'
  | 'first-poll-release'
  | 'first-election-result'

export interface TutorialMilestoneState {
  id: TutorialMilestoneId
  completedAt?: ISODate
  dismissedAt?: ISODate
}

export interface TutorialState {
  milestones: Record<TutorialMilestoneId, TutorialMilestoneState>
}

export type ExplanationKind = 'poll' | 'contest' | 'election'
export type ExplanationGroupId = 'events' | 'alignment' | 'commitments' | 'variance' | 'model'

export interface ExplanationContributor {
  label: string
  detail: string
  partyId?: PartyId
  magnitude?: number
  sourceId?: string
}

export interface ExplanationGroup {
  id: ExplanationGroupId
  title: string
  summary: string
  contributors: ExplanationContributor[]
}

export interface ExplanationRecord {
  id: string
  kind: ExplanationKind
  title: string
  summary: string
  date: ISODate
  groups: ExplanationGroup[]
}
