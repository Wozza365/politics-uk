import type { ISODate, PartyId } from './party'
import type { TierId } from './region'

export type ObjectiveLifecycle = 'available' | 'active' | 'succeeded' | 'failed' | 'expired'
export type ObjectiveKind = 'primary' | 'optional' | 'hidden' | 'historical'

export type CampaignCondition =
  | { type: 'date-on-or-after'; date: ISODate }
  | { type: 'date-on-or-before'; date: ISODate }
  | { type: 'polling-at-least'; partyId: PartyId | 'player'; value: number }
  | { type: 'polling-below'; partyId: PartyId | 'player'; value: number }
  | { type: 'projected-seats-at-least'; partyId: PartyId | 'player'; value: number }
  | { type: 'commons-seats-at-least'; partyId: PartyId | 'player'; value: number }
  | { type: 'cash-at-least'; partyId: PartyId | 'player'; value: number }
  | { type: 'membership-at-least'; partyId: PartyId | 'player'; value: number }
  | { type: 'action-taken'; actionId: string }
  | { type: 'event-action-taken'; eventId: string; actionId: string }
  | { type: 'arc-consequence'; consequenceId: string }
  | { type: 'election-outcome'; tier: TierId; result: 'won' | 'lost' }

export interface CampaignObjective {
  id: string
  kind: ObjectiveKind
  title: string
  description: string
  partyIds?: PartyId[]
  activeFrom?: ISODate
  expiresOn?: ISODate
  hiddenUntil?: CampaignCondition[]
  success: CampaignCondition[]
  failure?: CampaignCondition[]
}

export interface CampaignObjectiveRecord {
  objectiveId: string
  status: ObjectiveLifecycle
  availableAt?: ISODate
  activeAt?: ISODate
  completedAt?: ISODate
  reason?: string
}
