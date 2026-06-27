import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './game'
import { useScenarioStore } from './scenario'
import { useUiStore } from './ui'
import type { Contest, FeedEntry, GameEvent } from '@/types'

describe('useGameStore.resolveFeedAction', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function pendingEvent(): GameEvent {
    return {
      id: 'evt-1',
      headline: 'A by-election is called',
      scope: 'regional',
      severity: 'moderate',
      weight: 1,
      actions: [
        { id: 'campaign', label: 'Campaign hard', effects: { summary: 'A strong showing.' } },
        { id: 'ignore', label: 'Leave it to the local party' },
      ],
    }
  }

  function unactionedEntry(): FeedEntry {
    return {
      id: 'evt-1',
      date: '2025-01-02',
      headline: 'A by-election is called',
      status: 'unactioned',
      actions: [
        { id: 'campaign', label: 'Campaign hard' },
        { id: 'ignore', label: 'Leave it to the local party' },
      ],
    }
  }

  it('marks the entry actioned and records the chosen action + its effect', () => {
    const game = useGameStore()
    game.pendingEvents.push(pendingEvent())
    game.feed.push(unactionedEntry())

    game.resolveFeedAction('evt-1', 'campaign')

    const entry = game.feed[0]
    expect(entry.status).toBe('actioned')
    expect(entry.actionTaken).toBe('Campaign hard')
    expect(entry.effect).toBeTruthy()
    expect(entry.actions).toBeUndefined()
  })

  it('does nothing for an unknown entry id', () => {
    const game = useGameStore()
    game.feed.push(unactionedEntry())

    game.resolveFeedAction('does-not-exist', 'campaign')

    expect(game.feed[0].status).toBe('unactioned')
  })

  it('does nothing for an unknown action id', () => {
    const game = useGameStore()
    game.pendingEvents.push(pendingEvent())
    game.feed.push(unactionedEntry())

    game.resolveFeedAction('evt-1', 'does-not-exist')

    expect(game.feed[0].status).toBe('unactioned')
  })

  it('is a no-op on an already-actioned entry', () => {
    const game = useGameStore()
    game.pendingEvents.push(pendingEvent())
    const entry = unactionedEntry()
    entry.status = 'actioned'
    entry.actionTaken = 'Already resolved'
    game.feed.push(entry)

    game.resolveFeedAction('evt-1', 'campaign')

    expect(game.feed[0].actionTaken).toBe('Already resolved')
  })

  it('resolves a repeatable event correctly even when an earlier, already-actioned entry shares its id', () => {
    const game = useGameStore()
    // A repeatable event (`once: false`) fired once already this playthrough, was resolved, and
    // its feed entry is still sitting in `feed` — then it fires again later in the playthrough.
    const staleEntry = unactionedEntry()
    staleEntry.status = 'actioned'
    staleEntry.actionTaken = 'Campaign hard'
    staleEntry.actions = undefined
    game.feed.push(staleEntry)
    game.feed.push(unactionedEntry())
    game.pendingEvents.push(pendingEvent())

    game.resolveFeedAction('evt-1', 'ignore')

    expect(game.feed[0].actionTaken).toBe('Campaign hard') // untouched
    expect(game.feed[1].status).toBe('actioned')
    expect(game.feed[1].actionTaken).toBe('Leave it to the local party')
  })

  it("queues an action's polling effect instead of moving polling immediately", () => {
    const game = useGameStore()
    game.selectedPartyId = 'labour'
    game.polling = { labour: 25, conservative: 25 }
    const event = pendingEvent()
    event.actions![0].effects = { polling: [{ partyId: 'player', magnitude: 0.1 }], summary: 'A strong showing.' }
    game.pendingEvents.push(event)
    game.feed.push(unactionedEntry())

    game.resolveFeedAction('evt-1', 'campaign')

    expect(game.polling.labour).toBe(25)
    expect(game.pendingPollImpacts).toEqual([{ partyId: 'labour', magnitude: 0.1, source: 'event:evt-1:campaign' }])
  })

  function publishingEvent(): GameEvent {
    return {
      id: 'poll-evt',
      headline: 'A new opinion poll is published',
      scope: 'national',
      severity: 'minor',
      weight: 1,
      publishesPoll: true,
      actions: [{ id: 'ok', label: 'Acknowledge' }],
    }
  }

  it('publishes a poll (sets polling + appends history + clears the buffer) when a publishesPoll action event resolves', () => {
    const game = useGameStore()
    game.selectedPartyId = 'labour'
    game.date = '2025-01-05'
    const fullPolling = {
      labour: 28,
      conservative: 24,
      reform_uk: 22,
      liberal_democrat: 12,
      green: 8,
      workers_party: 1,
      ukip: 0.3,
      snp: 3,
    }
    game.polling = { ...fullPolling }
    game.pollingHistory = [{ date: '2025-01-01', polling: { ...fullPolling } }]
    game.pendingPollImpacts = [{ partyId: 'labour', magnitude: 0.25, source: 'major-event' }]
    game.pendingEvents.push(publishingEvent())
    game.feed.push({
      id: 'poll-evt',
      date: game.date,
      headline: publishingEvent().headline,
      status: 'unactioned',
      actions: [{ id: 'ok', label: 'Acknowledge' }],
    })

    game.resolveFeedAction('poll-evt', 'ok')

    expect(game.polling.labour).toBeGreaterThan(25)
    expect(game.pollingHistory).toHaveLength(2)
    expect(game.pollingHistory.at(-1)?.polling).toEqual(game.polling)
    expect(game.pendingPollImpacts).toEqual([])
  })
})

describe('useGameStore.checkElectionResult — P2.0', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('judges the win against the projected seat count, not the static starting one', () => {
    const game = useGameStore()
    const scenario = useScenarioStore()
    game.startGame('labour')
    scenario.scenario.nextElectionDate = game.date // election is "today"

    // Crash Labour's live polling relative to its scenario-start polling so the uniform-swing
    // projection should cost it seats versus the unprojected starting composition.
    game.polling.labour = Math.max(0.1, (scenario.scenario.polling.labour ?? 0) - 30)

    game.checkElectionResult()

    expect(game.result).not.toBeNull()
    expect(game.projectedPlayerSeatCount).toBeLessThan(game.playerSeatCount)
  })

  it('does not re-evaluate once a result is already recorded', () => {
    const game = useGameStore()
    const scenario = useScenarioStore()
    game.startGame('labour')
    scenario.scenario.nextElectionDate = game.date
    game.checkElectionResult()
    const firstResult = game.result

    game.polling.labour = 0.1 // would flip the outcome if re-evaluated
    game.checkElectionResult()

    expect(game.result).toBe(firstResult)
  })

  it('continuePlaying resumes the clock without clearing the recorded result', () => {
    const game = useGameStore()
    const scenario = useScenarioStore()
    game.startGame('labour')
    scenario.scenario.nextElectionDate = game.date
    game.checkElectionResult()
    expect(game.clock.running).toBe(false)

    game.continuePlaying()

    expect(game.clock.running).toBe(true)
    expect(game.result).not.toBeNull()
  })
})

describe('useGameStore player levers — P2.9', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('runFundraisingAppeal raises finance and starts a cooldown', () => {
    const game = useGameStore()
    game.startGame('labour')
    const before = game.finance.labour?.estimatedCashOnHand ?? 0

    game.runFundraisingAppeal()

    expect(game.finance.labour?.estimatedCashOnHand ?? 0).toBeGreaterThan(before)
    expect(game.leverCooldownRemaining('fundraising')).toBeGreaterThan(0)
    expect(game.feed.at(-1)?.headline).toContain('fundraising appeal')
  })

  it('runFundraisingAppeal is a no-op while on cooldown', () => {
    const game = useGameStore()
    game.startGame('labour')
    game.runFundraisingAppeal()
    const raised = game.finance.labour?.estimatedCashOnHand ?? 0
    const feedLength = game.feed.length

    game.runFundraisingAppeal()

    expect(game.finance.labour?.estimatedCashOnHand).toBe(raised)
    expect(game.feed.length).toBe(feedLength)
  })

  it('runSocialMediaCampaign grows membership and queues a polling impact through the existing seam', () => {
    const game = useGameStore()
    game.startGame('labour')
    const before = game.membership.labour ?? 0

    game.runSocialMediaCampaign()

    expect(game.membership.labour ?? 0).toBeGreaterThan(before)
    expect(game.pendingPollImpacts).toHaveLength(1)
    expect(game.pendingPollImpacts[0]).toMatchObject({ partyId: 'labour', source: 'lever:socialMedia' })
    expect(game.leverCooldownRemaining('socialMedia')).toBeGreaterThan(0)
  })

  it('lever cooldowns count down as the game date advances', () => {
    const game = useGameStore()
    game.startGame('labour')
    game.runSocialMediaCampaign()
    const remaining = game.leverCooldownRemaining('socialMedia')

    game.date = addDaysForTest(game.date, remaining)

    expect(game.leverCooldownRemaining('socialMedia')).toBe(0)
  })
})

function addDaysForTest(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('useGameStore by-elections — P2.8', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function commonsContest(overrides: Partial<Contest> = {}): Contest {
    return {
      id: 'byelection:commons:seat-0:2025-01-02',
      contestTier: 'commons',
      regionId: 'seat-0',
      geometryRef: 'seat-0',
      seatName: 'Seat 0',
      incumbentParty: 'conservative',
      calledDate: '2025-01-02',
      status: 'pending',
      ...overrides,
    }
  }

  it('tickDay generates contests deterministically over a long run, each with a matching feed entry', () => {
    const game = useGameStore()
    game.startGame('labour')
    for (let day = 0; day < 365; day++) game.tickDay()

    const commonsContests = game.contests.filter((c) => c.contestTier === 'commons')
    for (const contest of commonsContests) {
      expect(game.feed.some((entry) => entry.id === contest.id)).toBe(true)
    }
  })

  it('rolls council contests into one upserted "called this week" feed entry per ISO week', () => {
    const game = useGameStore()
    game.startGame('labour')
    for (let day = 0; day < 365; day++) game.tickDay()

    const councilContests = game.contests.filter((c) => c.contestTier === 'council')
    expect(councilContests.length).toBeGreaterThan(0)
    const weeklyEntries = game.feed.filter((entry) => entry.id.startsWith('byelection:council:week:'))
    // One entry per distinct ISO week a council contest landed in, never duplicated.
    const ids = weeklyEntries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('actionContest resolves the contest, queues its polling impact, and updates the matching commons feed entry', () => {
    const game = useGameStore()
    game.startGame('labour')
    game.contests.push(commonsContest())
    game.feed.push({
      id: 'byelection:commons:seat-0:2025-01-02',
      date: '2025-01-02',
      headline: 'By-election called: Seat 0 (Conservative hold).',
      status: 'unactioned',
      actions: [],
    })

    game.actionContest('byelection:commons:seat-0:2025-01-02', 'local_push')

    const contest = game.contests[0]
    expect(contest.status).toBe('resolved')
    expect(contest.actionId).toBe('local_push')
    expect(contest.resultLabel).toBeTruthy()
    expect(game.pendingPollImpacts).toHaveLength(1)
    const entry = game.feed[0]
    expect(entry.status).toBe('actioned')
    expect(entry.actionTaken).toBe('Local push')
    expect(entry.effect).toBe(contest.resultLabel)
  })

  it('actionContest is a no-op on an already-resolved contest', () => {
    const game = useGameStore()
    game.startGame('labour')
    const contest = commonsContest({ status: 'resolved', actionId: 'ignore', resultLabel: 'conservative hold' })
    game.contests.push(contest)

    game.actionContest(contest.id, 'local_push')

    expect(game.contests[0].actionId).toBe('ignore')
    expect(game.pendingPollImpacts).toEqual([])
  })

  it('resumeClockIfClear only resumes once both pendingEvents and ui.openMenus are clear', () => {
    const game = useGameStore()
    const ui = useUiStore()
    game.startGame('labour')
    game.pauseClock()
    ui.openMenu()

    game.resumeClockIfClear()
    expect(game.clock.running).toBe(false)

    ui.closeMenu()
    game.resumeClockIfClear()
    expect(game.clock.running).toBe(true)
  })
})

describe('useGameStore.toSaveState / hydrateFromSaveState — P3.0', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('round-trips equivalent state through a fresh store', () => {
    const game = useGameStore()
    game.startGame('labour')
    game.runFundraisingAppeal()
    const snapshot = game.toSaveState()

    setActivePinia(createPinia())
    const fresh = useGameStore()
    fresh.hydrateFromSaveState(snapshot)

    expect(fresh.toSaveState()).toEqual(snapshot)
    expect(fresh.clock.running).toBe(false)
  })

  it('drops a contest referencing a party id the current scenario no longer recognises', () => {
    const game = useGameStore()
    game.startGame('labour')
    const snapshot = game.toSaveState()
    const bogusContest: Contest = {
      id: 'byelection:commons:bogus:2025-01-01',
      contestTier: 'commons',
      regionId: 'not-a-real-region',
      geometryRef: 'not-a-real-region',
      seatName: 'Nowhereshire',
      incumbentParty: 'not-a-real-party',
      calledDate: '2025-01-01',
      status: 'pending',
    }

    game.hydrateFromSaveState({ ...snapshot, contests: [bogusContest] })

    expect(game.contests).toEqual([])
  })

  it('drops polling/finance/membership entries for unrecognised party ids instead of crashing', () => {
    const game = useGameStore()
    game.startGame('labour')
    const snapshot = game.toSaveState()

    game.hydrateFromSaveState({
      ...snapshot,
      polling: { ...snapshot.polling, 'ghost-party': 99 },
      finance: { ...snapshot.finance, 'ghost-party': { estimatedCashOnHand: 1, source: 'estimated' } },
      membership: { ...snapshot.membership, 'ghost-party': 1 },
      selectedPartyId: 'ghost-party',
    })

    expect(game.polling['ghost-party']).toBeUndefined()
    expect(game.finance['ghost-party']).toBeUndefined()
    expect(game.membership['ghost-party']).toBeUndefined()
    expect(game.selectedPartyId).toBeNull()
  })

  it('drops a pendingEventId that no longer matches anything in the event pool', () => {
    const game = useGameStore()
    game.startGame('labour')
    const snapshot = game.toSaveState()

    game.hydrateFromSaveState({ ...snapshot, pendingEventIds: ['not-a-real-event-id'] })

    expect(game.pendingEvents).toEqual([])
  })
})
