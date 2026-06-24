import type { ISODate, PartyId } from './party'

// London mayoralty, the ~11 combined-authority "metro" mayors, and the ~13
// single-council directly-elected local mayors (spec §4.1 rows 7-8). Modelled
// as a flat array rather than the Region/Seat shape used by multi-seat bodies
// (src/types/region.ts) since each is a single seat with no internal
// composition to track and no single map representation that fits all three
// kinds equally well (see P2.3 in docs/PHASE_2_COMPLETED.md for the design
// call this made: stats list, not a map overlay).
export type MayoraltyKind = 'london' | 'combined_authority' | 'local'

export interface Mayoralty {
  id: string // "mayor:<slug>"
  name: string // office title, e.g. "Mayor of London", "Mayor of Greater Manchester"
  kind: MayoraltyKind
  // Area slug, e.g. "greater_manchester". Not matched against any boundary
  // geometryRef -- none of these areas (combined authorities especially)
  // have boundary geometry in this dataset -- kept for future hover-linking
  // if/when that geometry is added.
  regionRef: string
  party: PartyId
  memberName: string
  electedAt: ISODate
}
