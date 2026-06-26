import { computed } from 'vue'
import { useGameStore, type LeverId } from '@/stores/game'

/** Cooldown-aware bindings for the player levers (P2.9, spec §9.3) — backs PartyPanel.vue's
 * expanded body. Fundraising/social media are the two levers wired to real sim effects so far;
 * staffing/policy/campaigning/leadership remain future work (`docs/phase2/P2.9-*.md`). */
export function usePartyLevers() {
  const game = useGameStore()

  function cooldownFor(leverId: LeverId) {
    return computed(() => game.leverCooldownRemaining(leverId))
  }

  return {
    fundraisingCooldownDays: cooldownFor('fundraising'),
    runFundraisingAppeal: () => game.runFundraisingAppeal(),
    socialMediaCooldownDays: cooldownFor('socialMedia'),
    runSocialMediaCampaign: () => game.runSocialMediaCampaign(),
  }
}
