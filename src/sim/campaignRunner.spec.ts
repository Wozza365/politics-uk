import { describe, expect, it } from 'vitest'
import fixtures from './campaignRunner.fixtures.json'
import { runCampaignBatch, runHeadlessCampaign, type CampaignRunnerAction } from './campaignRunner'

const labourFirstMonth: CampaignRunnerAction[] = [
  { day: 1, kind: 'lever', leverId: 'fundraising' },
  { day: 2, kind: 'lever', leverId: 'socialMedia' },
  { day: 5, kind: 'lever', leverId: 'staffing' },
  { day: 10, kind: 'saveRestore' },
  { day: 18, kind: 'lever', leverId: 'campaigning' },
]

describe('runHeadlessCampaign', () => {
  it('replays the first campaign month deterministically through the production stores', () => {
    const first = runHeadlessCampaign({
      partyId: 'labour',
      days: 31,
      playthroughSeed: 309,
      actions: labourFirstMonth,
      autoResolvePendingEvents: 'first',
      throwOnInvariantFailure: true,
    })
    const second = runHeadlessCampaign({
      partyId: 'labour',
      days: 31,
      playthroughSeed: 309,
      actions: labourFirstMonth,
      autoResolvePendingEvents: 'first',
      throwOnInvariantFailure: true,
    })

    expect(second).toEqual(first)
    expect(first.deterministicHash).toBe(fixtures.firstMonthLabour.deterministicHash)
    expect(first.indicators.saveRestoreChecks).toEqual({ attempted: 1, matched: 1 })
    expect(first.indicators.actionAvailability['lever:fundraising']).toBeGreaterThan(0)
    expect(first.indicators.pollingRangeByParty.labour.max).toBeGreaterThanOrEqual(first.indicators.pollingRangeByParty.labour.min)
  })

  it('exposes comparable balance indicators for large-party and small-party strategies', () => {
    const reports = runCampaignBatch({
      partyIds: ['labour', 'workers_party'],
      days: 120,
      playthroughSeed: 309,
      actions: [
        { day: 1, kind: 'lever', leverId: 'fundraising' },
        { day: 2, kind: 'lever', leverId: 'socialMedia' },
        { day: 15, kind: 'lever', leverId: 'policy' },
        { day: 30, kind: 'contest', tier: 'commons', actionId: 'local_push' },
        { day: 60, kind: 'lever', leverId: 'campaigning' },
      ],
      autoResolvePendingEvents: 'first',
      throwOnInvariantFailure: true,
    })

    expect(reports.map((report) => report.partyId)).toEqual(['labour', 'workers_party'])
    expect(reports.map((report) => report.difficulty)).toEqual(fixtures.balanceBatch.map((fixture) => fixture.difficulty))
    for (const report of reports) {
      expect(report.indicators.minCashByParty[report.partyId]).toBeGreaterThanOrEqual(-250_000)
      expect(report.indicators.pollingRangeByParty[report.partyId].max).toBeLessThanOrEqual(100)
      expect(report.invariantFailures).toEqual([])
    }
  }, 15_000)

  it('keeps P2.8 contests deterministic and reconciled over a generated contest window', () => {
    const report = runHeadlessCampaign({
      partyId: 'liberal_democrat',
      days: 365,
      playthroughSeed: 309,
      actions: [
        { day: 90, kind: 'contest', tier: 'commons', actionId: 'local_push' },
        { day: 180, kind: 'contest', tier: 'council', actionId: 'token_effort' },
        { day: 270, kind: 'contest', tier: 'commons', actionId: 'nationalise' },
      ],
      autoResolvePendingEvents: 'first',
      throwOnInvariantFailure: true,
    })

    expect(report.deterministicHash).toBe(fixtures.contestWindowLiberalDemocrat.deterministicHash)
    expect(report.contests.pending + report.contests.resolved).toBeGreaterThan(0)
    expect(report.indicators.contestWinRate.resolved).toBe(report.contests.resolved)
    expect(report.invariantFailures).toEqual([])
  }, 15_000)

  it('resolves a full general-election run once and keeps seats reconciled', () => {
    const report = runHeadlessCampaign({
      partyId: 'conservative',
      days: 1462,
      playthroughSeed: 309,
      actions: [
        { day: 1, kind: 'lever', leverId: 'fundraising' },
        { day: 30, kind: 'lever', leverId: 'staffing' },
        { day: 120, kind: 'lever', leverId: 'campaigning' },
        { day: 730, kind: 'saveRestore' },
      ],
      autoResolvePendingEvents: 'first',
      throwOnInvariantFailure: true,
    })

    expect(report.deterministicHash).toBe(fixtures.generalElectionConservative.deterministicHash)
    expect(report.indicators.electionOutcomes).toBe(1)
    expect(Object.values(report.commonsSeats).reduce((sum, value) => sum + value, 0)).toBe(650)
    expect(report.result).not.toBeNull()
  }, 20_000)
})
