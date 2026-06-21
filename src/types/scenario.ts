import type { ISODate, Party, PartyFinance, PartyId } from './party'
import type { Region, TierId } from './region'

export interface PollingSnapshot {
  date: ISODate
  polling: Record<PartyId, number>
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
  parties: Party[]
  polling: Record<PartyId, number> // headline VI %, scenario-start snapshot
  pollingHistory: PollingSnapshot[]
  finances: Record<PartyId, PartyFinance>
  membership: Record<PartyId, number>
}
