import type { ISODate } from './party'

// Minimal feed-entry type needed for P1.1's game store. P1.8 will build the full
// feed/event UI on top of this; P1.12 will add the richer GameEvent type for
// action-required events (currently typed as `unknown` in the game store).
export interface FeedEntry {
  id: string
  date: ISODate
  headline: string
  actionTaken?: string
}
