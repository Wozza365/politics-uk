import type { ISODate, Party, PartyFinance, PartyId } from './party'
import type { Region, TierId } from './region'

export interface Scenario {
  id: string // "uk-2025-01-01"
  date: ISODate
  label: string
  tiers: Record<TierId, Region[]>
  parties: Party[]
  polling: Record<PartyId, number> // headline VI %, scenario-start snapshot
  finances: Record<PartyId, PartyFinance>
  membership: Record<PartyId, number>
}
