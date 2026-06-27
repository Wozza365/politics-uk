import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useScenarioStore, REGIONAL_TIER_IDS, tierLabel } from '@/stores/scenario'
import { isRegionTargetable, TARGETED_CAMPAIGN } from '@/sim/targeting'
import { marginalityScore } from '@/sim/opponents'
import { describeDenial } from './useActionAvailability'
import type { ActiveCommitment, TargetScope } from '@/types'

/** Cap on how many commons seats the panel surfaces at once — every seat is technically
 * targetable, but listing all ~650 with no map-click/search step would defeat "must work without
 * precision pointer gestures" by burying the handful of seats actually worth campaigning in. The
 * most marginal seats are also the ones `sim/opponents.ts` itself prioritises, so this keeps the
 * player's options legible against the same ranking the AI uses. */
const MAX_SEAT_OPTIONS = 30

export interface TargetOption {
  scope: TargetScope
  label: string
  description: string
  forecastSummary: string
  cooldownDays: number
  allowed: boolean
  disabledReason?: string
  /** Multi-day commitments hold scarce capacity for two weeks — worth a confirming click, same as
   * `usePartyLevers.ts`'s lever cards. */
  requiresConfirmation: boolean
  focusGeometryRef?: string
  run: () => void
}

function scopesMatch(a: TargetScope, b: TargetScope): boolean {
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'national':
      return true
    case 'tier':
      return a.tierId === b.tierId
    case 'seat':
      return a.regionId === b.regionId
    case 'contest':
      return a.contestId === b.contestId
  }
}

/** Target selection + resolution bindings for `TargetingPanel.vue` (P3.4 step 2). Builds the list
 * of eligible scopes straight from existing scenario/tier data (never inventing a target the data
 * doesn't support — see `isRegionTargetable`), and wires each one through `game.runTargetingAction`,
 * the exact same store action `runOpponentCadence` uses for AI moves. */
export function useTargeting() {
  const game = useGameStore()
  const ui = useUiStore()
  const scenario = useScenarioStore()

  function commitmentsSummary(scope: TargetScope, commitments: ActiveCommitment[]): string | undefined {
    const matching = commitments.filter((c) => c.targetScope && scopesMatch(c.targetScope, scope))
    if (!matching.length) return undefined
    const names = matching.map((c) => scenario.party(c.partyId)?.shortName ?? c.partyId)
    return `Campaigning now: ${names.join(', ')}.`
  }

  function toOption(scope: TargetScope, baseDescription: string, focusGeometryRef?: string): TargetOption {
    const partyId = game.selectedPartyId
    const availability = partyId ? game.targetingAvailability(partyId, scope) : { allowed: false, reason: 'no-party' as const }
    const disabledReason = availability.allowed ? undefined : describeDenial(availability.reason)
    const commitments = commitmentsSummary(scope, game.activeTargetingCommitments)
    return {
      scope,
      label: scope.label,
      description: commitments ? `${baseDescription} ${commitments}` : baseDescription,
      forecastSummary: TARGETED_CAMPAIGN.forecast.summary,
      cooldownDays: game.targetingCooldownRemaining(scope),
      allowed: availability.allowed,
      disabledReason,
      requiresConfirmation: true,
      focusGeometryRef,
      run: () => {
        if (!partyId) return
        game.runTargetingAction(partyId, scope)
      },
    }
  }

  const nationalOption = computed<TargetOption>(() =>
    toOption(
      { kind: 'national', label: 'National campaign' },
      'Spread effort across the whole campaign rather than one place — a small, immediate national polling effect.',
    ),
  )

  const tierOptions = computed<TargetOption[]>(() =>
    REGIONAL_TIER_IDS.filter((tierId) => (scenario.scenario.tiers[tierId] ?? []).length > 0).map((tierId) =>
      toOption(
        { kind: 'tier', tierId, label: tierLabel(tierId) },
        `Campaign across every ${tierLabel(tierId)} seat at once — the same bounded local effect as a single seat, spread over more places.`,
      ),
    ),
  )

  const seatOptions = computed<TargetOption[]>(() => {
    const ranked = scenario.commonsRegions
      .filter((region) => isRegionTargetable(region) && region.seats[0])
      .map((region) => ({ region, marginality: marginalityScore(region.seats[0]) }))
      .filter((entry): entry is { region: (typeof scenario.commonsRegions)[number]; marginality: number } => entry.marginality !== null)
      .sort((a, b) => a.marginality - b.marginality)
      .slice(0, MAX_SEAT_OPTIONS)

    return ranked.map(({ region }) => {
      const seat = region.seats[0]
      const holderName = scenario.party(seat.party)?.shortName ?? seat.party
      const competitiveness =
        seat.majority != null && seat.electorate
          ? `Held by ${holderName}, majority ${seat.majority.toLocaleString()} of ${seat.electorate.toLocaleString()} electors.`
          : `Held by ${holderName}.`
      return toOption({ kind: 'seat', regionId: region.id, label: region.name }, competitiveness, region.geometryRef)
    })
  })

  const options = computed<TargetOption[]>(() => [nationalOption.value, ...tierOptions.value, ...seatOptions.value])

  function focusOnMap(geometryRef: string) {
    ui.requestMapFocus({ view: 'westminster', geometryRef })
  }

  return { options, focusOnMap }
}
