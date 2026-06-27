import type { ActionCost } from './action'
import type { ISODate, PartyId } from './party'

// P2.8 runtime by-election/minor-election contracts (spec §9.5 "expandable later to list
// by-elections and other minor elections in detail"). `Contest`s are generated at runtime by
// `sim/byElections.ts` from scenario seats + seeded randomness, not pre-authored — see that
// module for why. A contest's outcome is narrative/polling-only for now: it does not mutate which
// party holds the underlying seat (that overlay is explicitly deferred to P3.5).

export type ContestTier = 'commons' | 'council'

export interface Contest {
  id: string // `byelection:${contestTier}:${regionId}:${calledDate}`
  contestTier: ContestTier
  regionId: string // Region.id the vacancy is in
  geometryRef: string // Region.geometryRef — map focus target
  councilGeometryRef?: string // ward contests: parent council's geometryRef, for map drill-down
  councilLevel?: 'county' | 'local' // ward contests: which council-level view to drill into (mirrors stores/scenario.ts's CouncilLevelId, kept as a plain union here since sim/ never imports stores/)
  seatName: string // constituency name, or "<ward>, <council>" for a ward contest
  incumbentParty: PartyId
  calledDate: ISODate
  status: 'pending' | 'resolved'
  actionId?: ContestActionId
  resultLabel?: string // set once resolved, e.g. "Labour hold" / "Conservative gain"
}

export type ContestActionId = 'ignore' | 'token_effort' | 'local_push' | 'nationalise'

export interface ContestActionDef {
  id: ContestActionId
  label: string
  description: string
  /** P3.3 action economy — paid (and validated against the acting party's resources) before
   * `resolveContestAction` runs; `ignore` always costs nothing. */
  cost: ActionCost
}
