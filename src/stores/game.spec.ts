import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './game'
import { useScenarioStore } from './scenario'
import type { FeedEntry, GameEvent } from '@/types'

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
