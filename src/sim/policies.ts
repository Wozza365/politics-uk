// The policy registry + world issue-salience (spec §4.4, §10.5.1 step 1).
//
// Hand-authored starting set, flagged tunable/estimated (per PHASE_1_PLAN.md P1.11.1):
// the illustrative major/minor lists from spec §4.4, refined when manifestos are scored.
import type { PolicyDef, PolicyId, PolicyTier } from '@/types'
import registry from '@/data/sim/policies.json'

export const POLICY_REGISTRY: PolicyDef[] = registry.policies as PolicyDef[]

/** The world's current issue salience (0…1) per policy area; events (P1.12) shift these. */
export const WORLD_SALIENCE: Record<PolicyId, number> = registry.salience

/** Major areas count for more than minor ones in the sim (spec §10.5.1 step 1). */
export const TIER_WEIGHT: Record<PolicyTier, number> = { major: 1, minor: 0.35 }

export function getPolicyDef(id: PolicyId): PolicyDef | undefined {
  return POLICY_REGISTRY.find((policy) => policy.id === id)
}
