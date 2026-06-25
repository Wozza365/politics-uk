import type { ISODate, PartyId } from './party'

export type TierId = string // "commons", "lords", "holyrood", "senedd", "council:metropolitan", ...

export interface CandidateResult {
  party: PartyId
  candidateName?: string
  votes: number
  voteShare: number // % of total vote in this result, winner first when sorted
}

export interface Seat {
  regionId: string
  party: PartyId // current holder
  memberName?: string
  majority?: number // votes; for Commons hover stats
  voteShare?: number // % at last relevant election (winner's share)
  electedAt?: ISODate
  turnout?: number // votes cast, last relevant election
  electorate?: number // registered electorate, last relevant election
  results?: CandidateResult[] // full ranked breakdown, winner first
  wardName?: string // council tiers (P2.4)
  nextElection?: ISODate // council tiers (P2.4)
  seatType?: 'councillor'
}

export interface Region {
  // one unit within a tier
  id: string // ONS/GSS code where available, e.g. "E14001305"
  tier: TierId
  name: string
  geometryRef: string // key into the boundary topojson for this tier
  seats: Seat[]
  councilGeometryRef?: string // ward/division drilldown parent (P2.4)
  councilName?: string // ward/division drilldown parent (P2.4)
  control?: {
    label: string
    party: PartyId
    source: string
    asOf: string
  }
}

// Constituency-level reference data for cross-referencing against the
// hover tooltip (spec §9.1) — kept as a sibling dataset rather than on
// Region directly (see demographics.commons.json), joined by regionId
// (the same PCON24 code used as Region.id/geometryRef for the commons tier).
// Fields are left undefined rather than estimated/guessed wherever no
// official source could be reached for this pass (see sources.json for the
// per-field gap notes) — only medianHouseholdIncomeGBP is expected to ever
// carry source: 'estimated', once added.
export interface RegionDemographics {
  regionId: string
  population?: number // mid-year estimate, most recent available
  areaSqKm?: number
  populationDensityPerKm2?: number
  employmentRatePct?: number // age 16-64
  unemploymentRatePct?: number // age 16+
  economicInactivityRatePct?: number // age 16-64
  medianAge?: number
  medianHouseholdIncomeGBP?: number // source: 'estimated' once populated (not in this pass)
  urbanRural?: 'urban' | 'rural' | 'mixed'
  qualifications?: { noQualifications: number; level1to2: number; level3: number; level4Plus: number } // %
  source: 'official' | 'estimated'
  asOf?: string // period the figures relate to, e.g. "mid-2024" or "Oct 2023-Sep 2024"
  notes?: string // coverage caveats, e.g. nation not covered by the underlying source
}
