// The daily event roll (spec §10, PHASE_1_PLAN.md P1.12.2): each tick, weigh up which events from
// the pool are currently eligible (per their date `window` and whether they've already fired) and
// deterministically roll whether one of them fires — most days, none does.
import type { EventPollingEffect, GameEvent, ISODate, PartyId } from '@/types'
import type { PollingImpact } from './poll'
import { seededUniform } from './rng'
import seedPool from '@/data/scenarios/uk-2025-01-01/events.seed.json'
import scriptedPool from '@/data/scenarios/uk-2025-01-01/events.scripted.json'

/** Baseline always-eligible ambient/minor events, plus the date-windowed, more dramatic ones
 * (by-elections, World Cup bank holidays, a war breaking out…) authored separately so the two
 * "kinds" of event are easy to extend independently as the library grows. */
export const EVENT_POOL: GameEvent[] = [...(seedPool as GameEvent[]), ...(scriptedPool as GameEvent[])]

/** How much "nothing happens today" mass to weigh against the eligible pool's total weight — the
 * bigger this is relative to typical pool weights, the quieter most days are. Tuned, not derived. */
const QUIET_WEIGHT = 40

function inWindow(event: GameEvent, date: ISODate): boolean {
  const window = event.window
  if (!window) return true
  if (window.from && date < window.from) return false
  if (window.to && date > window.to) return false
  return true
}

/** Events still in play for `date`: within their window (if any) and not already fired (unless
 * explicitly marked repeatable with `once: false`). */
export function eligibleEvents(pool: GameEvent[], date: ISODate, firedEventIds: string[]): GameEvent[] {
  const fired = new Set(firedEventIds)
  return pool.filter((event) => {
    if (event.once !== false && fired.has(event.id)) return false
    return inWindow(event, date)
  })
}

/**
 * One day's event roll. Deterministic per `date` (no `Math.random`, per the sim's determinism
 * rule) so a playthrough's events are reproducible. Returns `null` on a quiet day — most days are.
 */
export function rollEventForDay(
  date: ISODate,
  firedEventIds: string[],
  pool: GameEvent[] = EVENT_POOL,
): GameEvent | null {
  const eligible = eligibleEvents(pool, date, firedEventIds)
  if (eligible.length === 0) return null

  const totalWeight = eligible.reduce((sum, event) => sum + event.weight, 0)
  if (totalWeight <= 0) return null

  const fires = seededUniform(`event-roll:${date}`) < totalWeight / (totalWeight + QUIET_WEIGHT)
  if (!fires) return null

  const pick = seededUniform(`event-pick:${date}`) * totalWeight
  let cumulative = 0
  for (const event of eligible) {
    cumulative += event.weight
    if (pick <= cumulative) return event
  }
  return eligible[eligible.length - 1]
}

export interface PollingEffectContext {
  selectedPartyId: PartyId | null
  commonsSeatsByParty: Record<PartyId, number>
}

/** Resolves an event/action's declarative `EventPollingEffect[]` (which can reference `'player'`
 * or `'incumbent'` instead of a fixed party id) into concrete `PollingImpact`s the engine
 * understands, dropping any that can't be resolved (e.g. `'player'` before a party is selected). */
export function resolvePollingEffects(
  effects: EventPollingEffect[] | undefined,
  ctx: PollingEffectContext,
  source: string,
): PollingImpact[] {
  if (!effects?.length) return []
  const [incumbentId] = Object.entries(ctx.commonsSeatsByParty).sort((a, b) => b[1] - a[1])[0] ?? []

  const impacts: PollingImpact[] = []
  for (const effect of effects) {
    const partyId =
      effect.partyId === 'player' ? ctx.selectedPartyId : effect.partyId === 'incumbent' ? incumbentId : effect.partyId
    if (partyId) impacts.push({ partyId, magnitude: effect.magnitude, source })
  }
  return impacts
}
