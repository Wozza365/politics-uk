import type { ISODate, PartyId } from './party'

export type TierId = string // "commons", "holyrood", "senedd", "council:metropolitan", ...

export interface Seat {
  regionId: string
  party: PartyId // current holder
  memberName?: string
  majority?: number // votes; for Commons hover stats
  voteShare?: number // % at last relevant election
  electedAt?: ISODate
}

export interface Region {
  // one unit within a tier
  id: string // ONS/GSS code where available, e.g. "E14001305"
  tier: TierId
  name: string
  geometryRef: string // key into the boundary topojson for this tier
  seats: Seat[]
}
