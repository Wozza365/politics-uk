import type { ISODate } from './party'
import type { PartyId } from './party'

// P1.12 event schema (spec §10 / PHASE_1_PLAN.md P1.12.1). A GameEvent is the authored,
// data-driven shape; `sim/events.ts` rolls one (or none) from the pool each tick, and
// `stores/game.ts` turns whatever fires into a `FeedEntry` below.

export type EventScope = 'local' | 'regional' | 'national' | 'international'
/** Coarse impact band, independent of `weight` — lets minor "a minister tweeted" stories sit in
 * the same pool as "war breaks out" without one numeric field doing double duty. */
export type EventSeverity = 'minor' | 'moderate' | 'major'

export interface EventWindow {
  /** Inclusive ISO date the event becomes eligible to roll. Omit for "eligible from the start". */
  from?: ISODate
  /** Inclusive ISO date after which the event can no longer roll. Omit for "never expires". */
  to?: ISODate
}

export interface EventPollingEffect {
  /** A concrete party id, `'player'` (resolved to whichever party the human is playing), or
   * `'incumbent'` (resolved to the party currently holding the most Commons seats). */
  partyId: PartyId | 'player' | 'incumbent'
  /** -1 (maximally damaging) … +1 (maximally boosting) — same scale as `sim/poll.ts`'s `PollingImpact`. */
  magnitude: number
}

export interface EventEffects {
  polling?: EventPollingEffect[]
  /** Additive nudge to world issue salience (spec §10.5.1 step 1), keyed by `PolicyId`; clamped
   * to [0,1] when applied. */
  salienceShift?: Record<string, number>
  /** Feed-display text shown under the headline once this fires/resolves. */
  summary?: string
}

export interface GameEventAction {
  id: string
  label: string
  effects?: EventEffects
  /** Key into the event-callback registry (`sim/eventCallbacks.ts`) for logic that can't be
   * expressed as a flat data effect — typically because it depends on *current* game state
   * (e.g. "boost whoever currently governs") rather than anything knowable at authoring time.
   * Runs after `effects` are applied. Most actions need no callback at all. */
  callbackId?: string
}

export interface GameEvent {
  id: string
  headline: string
  body?: string
  scope: EventScope
  severity: EventSeverity
  /** Relative likelihood among *eligible* events on a given day (see `sim/events.ts`) — not a
   * probability by itself; the roll also weighs a "nothing happens" outcome. */
  weight: number
  /** Date range this event is eligible to roll within. A recurring real-world event (an annual
   * honours list, a seasonal storm…) is authored as several `GameEvent`s with different `id`s and
   * windows rather than one event with repeat logic. */
  window?: EventWindow
  /** Default `true`: once fired (action events: once *resolved*) it's removed from the pool for
   * the rest of the playthrough. Set `false` for repeatable ambient events. */
  once?: boolean
  /** Applied immediately when the event fires. Only used when there are no `actions` — action
   * events apply effects via whichever action the player picks instead. */
  effects?: EventEffects
  /** If present, firing this event pauses the clock and queues it as a `pendingEvent` until the
   * player picks one of these (spec §9.5/§10). */
  actions?: GameEventAction[]
  /** Same escape hatch as `GameEventAction.callbackId`, but for non-action events — runs
   * immediately when the event fires, since there's no action to attach it to. */
  callbackId?: string
  /** Marks this as a poll-publishing event: firing it triggers a full polling recalculation
   * (trend + every impact accumulated since the last poll), sets `polling` to the result, and
   * appends that result to `pollingHistory` — see `sim/poll.ts`'s `nextPollingSnapshot`. Replaces
   * the old "recalculate every day" cadence with "recalculate whenever a poll is published". */
  publishesPoll?: boolean
}

/** What an event callback (`sim/eventCallbacks.ts`) is handed to do its work. Deliberately a
 * narrow, store-agnostic interface (not the Pinia store itself) so `sim/` never imports
 * `stores/` — `stores/game.ts` builds one of these from closures over its own state. */
export interface EventCallbackContext {
  event: GameEvent
  /** The chosen action's id, when this callback ran from an action rather than the bare event. */
  actionId?: string
  date: ISODate
  selectedPartyId: PartyId | null
  /** Current Commons seat counts by party — the cheapest way for a callback to work out things
   * like "the governing party" without needing its own store import. */
  commonsSeatsByParty: Record<PartyId, number>
  applyPollingImpacts(impacts: EventPollingEffect[]): void
  bumpSalience(policyId: string, delta: number): void
  /** Append a follow-up line to the feed entry this event/action produced. */
  appendSummary(text: string): void
}

export interface FeedEntryAction {
  id: string
  label: string
}

export interface FeedEntry {
  id: string
  date: ISODate
  headline: string
  /** 'unactioned' renders choice buttons; 'actioned' renders the choice made + its effect. */
  status: 'actioned' | 'unactioned'
  /** Set once resolved: the action taken (often an action's `label`) and its effect. */
  actionTaken?: string
  effect?: string
  /** Choices rendered as buttons while `status` is 'unactioned'. */
  actions?: FeedEntryAction[]
}
