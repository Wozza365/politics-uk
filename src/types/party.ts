import type { CompassSummary, PolicyId, PolicyStance } from './policy'

export type PartyId = string // stable slug, e.g. "labour", "snp"
export type ISODate = string // "2025-01-01"

export interface PartyOfficer {
  role: 'leader' | 'deputy_leader' | 'chair' | 'chief_whip' | string
  personName: string
  since?: ISODate
  portrait?: string // placeholder image with name for now
}

export interface Party {
  id: PartyId
  name: string
  shortName: string // "Lab", "Con", "LD"
  colours: { primary: string; secondary?: string; onPrimary: string } // onPrimary = WCAG-safe text
  logo?: string
  scope: 'national' | 'regional' | 'local' // only 'national' is selectable for now (spec §7.2)
  leadership: PartyOfficer[]
  founded?: number
  mergedFrom?: string[] // sister parties folded into this one (spec §4.3)
  compass?: CompassSummary // overall position; the shaded circle on cards/panel (spec §4.4)
  stances?: Record<PolicyId, PolicyStance> // per-policy positions for the sim engine (spec §10.5)
}

export interface PartyFinance {
  estimatedCashOnHand?: number // £, may be estimated - flag provenance
  annualIncome?: number
  source: 'reported' | 'estimated'
}
