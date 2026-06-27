import type { ActionDenialReason } from '@/types'

/** Player-facing text for why an action is greyed out — the one place a denial reason becomes a
 * sentence, shared by lever cards and contest cards alike. */
export function describeDenial(reason: ActionDenialReason): string {
  switch (reason) {
    case 'no-party':
      return 'No party selected.'
    case 'on-cooldown':
      return 'Still on cooldown.'
    case 'insufficient-money':
      return 'Not enough money.'
    case 'insufficient-staff':
      return 'Not enough staff capacity free.'
    case 'insufficient-leadership':
      return "Not enough of the leader's attention free."
    case 'already-committed':
      return 'Already running.'
    case 'capacity-full':
      return 'Too many ongoing commitments already.'
  }
}
