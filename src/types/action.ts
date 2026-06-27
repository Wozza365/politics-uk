import type { ISODate, PartyId } from './party'
import type { PollingImpact } from '@/sim/poll'

// P3.3 campaign action economy (spec — turn P2.9's levers and P2.8's contest choices into
// consequential decisions). Every lever, by-election response, and future opponent move shares
// this contract: validate availability -> pay costs -> apply typed effects -> record outcome ->
// schedule autosave. `sim/actions.ts` is the only place that interprets these types; stores apply
// the result, components only ever request an action by id.

/** Player-lever ids (P2.9 — spec §9.3 "Expanded … levers") — each lever is a stable
 * `ActionDefinition` in `sim/actions.ts`'s `LEVER_ACTIONS`. */
export type LeverId = 'fundraising' | 'socialMedia' | 'policy' | 'staffing' | 'campaigning' | 'leadership'

/** Namespaces a lever id and a by-election `ContestActionId` (`@/types/election.ts`) into the one
 * id-space `ActiveCommitment.actionId` and cooldown/availability lookups share. */
export type ActionId = string

/** Upfront amounts an action requires. `money` is always a real, permanent spend. `staff`/
 * `leadership` for an instant action (`durationDays` 0) are a momentary eligibility gate only — the
 * party needs that much capacity *free* to execute, but nothing is permanently consumed. For an
 * ongoing commitment they're *held* (unavailable to every other action) for the commitment's
 * `durationDays`, then released back in full when it ends or is cancelled. */
export interface ActionCost {
  money?: number
  staff?: number
  leadership?: number
}

export interface ActionForecast {
  /** Bounded uncertainty range for the headline polling effect, on `PollingImpact`'s -1..+1
   * magnitude scale — shown to the player before they commit, not just after. */
  pollingMagnitudeRange?: [number, number]
  summary: string
}

export interface ActionDefinition {
  id: ActionId
  label: string
  description: string
  /** Days before this party can take this exact action again, counted from when it was started. */
  cooldownDays: number
  /** 0 = resolves immediately; >0 = becomes an `ActiveCommitment` occupying capacity until it ends. */
  durationDays: number
  /** Paid once, immediately, when the action is taken. */
  cost: ActionCost
  /** Paid once per day for the life of an ongoing commitment (`durationDays > 0` only). */
  recurringCost?: ActionCost
  forecast: ActionForecast
}

export type ActionDenialReason =
  | 'no-party'
  | 'on-cooldown'
  | 'insufficient-money'
  | 'insufficient-staff'
  | 'insufficient-leadership'
  | 'already-committed'
  | 'capacity-full'

export type ActionAvailability = { allowed: true } | { allowed: false; reason: ActionDenialReason }

/** A party's resource snapshot for one availability check — assembled by the store from its own
 * state each call; `sim/actions.ts` never reaches into a store. */
export interface ActionResourceState {
  money: number
  staffAvailable: number
  leadershipAvailable: number
  /** How many ongoing commitments this party already has running — a deliberately blunt "time/
   * turn capacity" cap independent of money/staff/leadership (spec step 2's fourth resource). */
  activeCommitmentCount: number
  cooldownRemainingDays: number
  /** True if this party already has an active commitment for this exact action id. */
  alreadyCommitted: boolean
}

/** A multi-day commitment occupying capacity (P3.3 step 4) — any action with `durationDays > 0`
 * becomes one of these until it expires (or is cancelled) on the daily tick. Its outcome is
 * computed once, deterministically, at the moment it starts, and only *applied* when it ends —
 * so "same seed -> same result" holds regardless of how a save happens to land mid-commitment. */
export interface ActiveCommitment {
  id: string // `${actionId}:${partyId}:${startedDate}` — unique per instance
  actionId: ActionId
  partyId: PartyId
  startedDate: ISODate
  endsDate: ISODate
  recurringCost?: ActionCost
  staffHeld: number
  leadershipHeld: number
  pollingImpacts: PollingImpact[]
  financeDelta: number
  membershipDelta: number
  /** Staffing's "recruitment drive" is the one lever that permanently grows capacity rather than
   * just affecting polling/finance/membership. */
  staffCapacityBonus?: number
  resultLabel: string
}

/** What `resolveLeverAction`/contest resolution hands back — for an instant action, applied
 * straight away; for a commitment, copied onto the `ActiveCommitment` and applied at expiry. */
export interface ActionOutcome {
  pollingImpacts: PollingImpact[]
  financeDelta: number
  membershipDelta: number
  resultLabel: string
  staffCapacityBonus?: number
}
