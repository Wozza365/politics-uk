import type { ISODate } from './party'

// P1.12 will add the richer GameEvent type (triggers/conditions/weighted effects) that
// generates these; for now FeedEntry is both the feed-display shape and the player's lever
// for resolving action-required events (see `useGameStore.resolveFeedAction`).
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
  /** Set once resolved: the action taken (often an action's `label`) and its effect.
   * `effect` is placeholder text until P1.11/P1.12 wire real simulation effects. */
  actionTaken?: string
  effect?: string
  /** Choices rendered as buttons while `status` is 'unactioned'. */
  actions?: FeedEntryAction[]
}
