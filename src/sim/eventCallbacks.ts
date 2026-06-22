import type { EventCallbackContext } from '@/types'

export type EventCallback = (ctx: EventCallbackContext) => void

/**
 * Escape hatch for event/action logic that can't be expressed as a flat data effect — almost
 * always because it depends on *current* game state rather than anything knowable when the
 * event was authored. The canonical example: "the governing party gets a boost" can't be a fixed
 * `partyId` in JSON, because who governs is whatever the sim says at the moment the event fires.
 * Keyed by `GameEvent.callbackId` / `GameEventAction.callbackId`; most events need no entry here.
 */
export const EVENT_CALLBACKS: Record<string, EventCallback> = {
  /** England wins the World Cup; the PM declares a bank holiday and rides the feel-good bump —
   * "the PM" is whichever party currently holds the most Commons seats, not a fixed id. */
  'world-cup-bank-holiday': (ctx) => {
    const [incumbentId] = Object.entries(ctx.commonsSeatsByParty).sort((a, b) => b[1] - a[1])[0] ?? []
    if (!incumbentId) return
    ctx.applyPollingImpacts([{ partyId: incumbentId, magnitude: 0.25 }])
    ctx.appendSummary('The governing party basks in the reflected glory of a national holiday.')
  },

  /** Whichever side of the Iran question the player takes, defence & foreign affairs dominates
   * the news cycle for a while — condemning the escalation cools it faster than backing it. */
  'trump-iran-war': (ctx) => {
    ctx.bumpSalience('defence_foreign', ctx.actionId === 'condemn' ? 0.1 : 0.25)
    ctx.appendSummary('Defence & foreign affairs dominates the news cycle.')
  },
}

/** Looks up and runs `callbackId` against `ctx`, if one is registered; a no-op otherwise so most
 * events/actions (which have no `callbackId`) cost nothing here. */
export function runEventCallback(callbackId: string | undefined, ctx: EventCallbackContext): void {
  if (!callbackId) return
  EVENT_CALLBACKS[callbackId]?.(ctx)
}
