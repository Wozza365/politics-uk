import type { Mayoralty } from './mayoralty'
import type { CampaignArc } from './campaignArc'
import type { CampaignObjective } from './objective'
import type { ISODate, Party, PartyFinance, PartyId } from './party'
import type { Region, TierId } from './region'

export interface PollingSnapshot {
  date: ISODate
  polling: Record<PartyId, number>
}

export interface CampaignBriefing {
  headline: string
  summary: string
  facts: string[]
  assumptions: string[]
  fictionalPremises: string[]
}

export interface CampaignScenarioConfig {
  schemaVersion: 1
  briefing: CampaignBriefing
  electoralHorizon: {
    label: string
    expectedEndDate: ISODate
    description: string
  }
  primaryObjectives: CampaignObjective[]
  optionalObjectives: CampaignObjective[]
  featureFlags: string[]
  expectedTiers: TierId[]
  tuning: Record<string, number>
  arcs: CampaignArc[]
}

export interface Scenario {
  id: string // "uk-2025-01-01"
  date: ISODate
  label: string
  // Placeholder for MVP (P1.1): not a researched figure for the real next UK
  // general election — just a reasonable ~5-years-out stand-in so daysUntilElection
  // has something to compute against. Replace with a real date when known.
  nextElectionDate?: ISODate
  tiers: Record<TierId, Region[]>
  mayoralties: Mayoralty[]
  parties: Party[]
  polling: Record<PartyId, number> // headline VI %, scenario-start snapshot
  pollingHistory: PollingSnapshot[]
  finances: Record<PartyId, PartyFinance>
  membership: Record<PartyId, number>
  campaign?: CampaignScenarioConfig
}
