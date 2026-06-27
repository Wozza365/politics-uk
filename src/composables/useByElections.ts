import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { CONTEST_ACTIONS_BY_TIER, startOfIsoWeek } from '@/sim/byElections'
import type { Contest, ContestActionId } from '@/types'

export interface CouncilContestWeek {
  week: string
  contests: Contest[]
}

/** Backs `ByElectionsPanel.vue`: pending/resolved contests grouped the way the panel presents
 * them (P2.8, spec §9.5) — parliamentary contests individually, council contests by ISO week. */
export function useByElections() {
  const game = useGameStore()
  const ui = useUiStore()

  const commonsContests = computed(() =>
    [...game.contests]
      .filter((contest) => contest.contestTier === 'commons')
      .sort((a, b) => (a.calledDate < b.calledDate ? 1 : -1)),
  )

  const councilContestsByWeek = computed<CouncilContestWeek[]>(() => {
    const groups = new Map<string, Contest[]>()
    for (const contest of game.contests) {
      if (contest.contestTier !== 'council') continue
      const week = startOfIsoWeek(contest.calledDate)
      const list = groups.get(week) ?? []
      list.push(contest)
      groups.set(week, list)
    }
    return [...groups.entries()]
      .map(([week, contests]) => ({ week, contests }))
      .sort((a, b) => (a.week < b.week ? 1 : -1))
  })

  function actionsFor(contest: Contest) {
    return CONTEST_ACTIONS_BY_TIER[contest.contestTier]
  }

  function actOnContest(contestId: string, actionId: ContestActionId) {
    game.actionContest(contestId, actionId)
  }

  /** Drives the map-focus seam (`ui.mapFocusRequest`) rather than touching MapView directly. */
  function focusOnMap(contest: Contest) {
    if (contest.contestTier === 'commons') {
      ui.requestMapFocus({ view: 'westminster', geometryRef: contest.geometryRef })
    } else if (contest.councilGeometryRef && contest.councilLevel) {
      ui.requestMapFocus({
        view: 'councils',
        councilLevel: contest.councilLevel,
        geometryRef: contest.councilGeometryRef,
      })
    }
  }

  return { commonsContests, councilContestsByWeek, actionsFor, actOnContest, focusOnMap }
}
