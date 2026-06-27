import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { LEVER_ACTIONS } from '@/sim/actions'
import { describeDenial } from './useActionAvailability'
import type { LeverId } from '@/types'

const LEVER_IDS = Object.keys(LEVER_ACTIONS) as LeverId[]

/** Cooldown/availability-aware bindings for every player lever (P2.9, spec §9.3; P3.3's shared
 * action economy) — backs PartyPanel.vue's expanded body with one generic list instead of one
 * hand-wired prop set per lever. */
export function usePartyLevers() {
  const game = useGameStore()

  const levers = computed(() =>
    LEVER_IDS.map((id) => {
      const def = LEVER_ACTIONS[id]
      const availability = game.leverAvailability(id)
      return {
        id,
        label: def.label,
        description: def.description,
        forecastSummary: def.forecast.summary,
        cooldownDays: game.leverCooldownRemaining(id),
        allowed: availability.allowed,
        disabledReason: availability.allowed ? undefined : describeDenial(availability.reason),
        /** Multi-day commitments hold scarce capacity for days and aren't free to undo — worth a
         * confirmation click; instant levers stay one-click brisk (spec step 6). */
        requiresConfirmation: def.durationDays > 0,
        run: () => game.runLeverAction(id),
      }
    }),
  )

  return { levers }
}
