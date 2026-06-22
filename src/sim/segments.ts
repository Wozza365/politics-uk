// Voter segments + each party's core base (spec §10.5.1 step 3), positioned in
// the same 2D compass space as policy stances. Hand-authored MVP set, flagged
// tunable/estimated (per PHASE_1_PLAN.md P1.11.2); structured for later
// data-driven refinement (e.g. polling-derived segment sizes).
import type { CompassPosition, PartyId } from '@/types'
import segmentsData from '@/data/sim/segments.json'

export interface VoterSegment {
  id: string
  name: string
  position: CompassPosition
  /** Relative size; segments are normalised to the field's polling total before use. */
  weight: number
  /** Marks this segment as `partyId`'s core identity base, for the betrayal penalty. */
  coreBaseFor?: PartyId
}

export const VOTER_SEGMENTS: VoterSegment[] = segmentsData as VoterSegment[]

export function getCoreBase(partyId: PartyId): VoterSegment | undefined {
  return VOTER_SEGMENTS.find((segment) => segment.coreBaseFor === partyId)
}
