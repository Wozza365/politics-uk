// The political-compass model for party stances (spec §4.4, §10.5).
//
// Every stance is a point on a 2D compass rather than a single left/right
// slider, plus a "consistency" value that the UI renders as a shaded, bordered
// circle whose radius grows as consistency falls.

/** The two compass dimensions every stance is expressed on. */
export interface CompassPosition {
  economic: number // -1 (left) … +1 (right)
  social: number // -1 (libertarian) … +1 (authoritarian)
}

export type PolicyId = string // stable slug, e.g. "immigration", "net_zero"
export type PolicyTier = 'major' | 'minor'

/**
 * Registry entry describing a policy area. Major areas carry more weight in the
 * simulation (spec §10.5); minor areas have a smaller effect but can have
 * passionate supporters/opponents, and some only apply to certain parties.
 */
export interface PolicyDef {
  id: PolicyId
  name: string
  tier: PolicyTier
  partySpecific?: boolean // true for minor areas only some parties hold a stance on
}

/** A party's position on one policy area. */
export interface PolicyStance {
  position: CompassPosition
  consistency: number // 0…1; circle radius in the compass view grows as this falls
  salience: number // 0…1; how much this issue currently matters (sim weighting, spec §10.5)
  source: 'manifesto' | 'estimated'
}

/** A party's overall compass position (the at-a-glance circle on cards/panel). */
export interface CompassSummary {
  position: CompassPosition
  consistency: number // drives the summary circle radius
}
