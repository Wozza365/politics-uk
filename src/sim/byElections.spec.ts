import { describe, expect, it } from 'vitest'
import { resolveContestAction, rollByElectionsForDay, startOfIsoWeek } from './byElections'
import type { Contest, Region } from '@/types'

function commonsPool(count: number): Region[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seat-${i}`,
    tier: 'commons',
    name: `Seat ${i}`,
    geometryRef: `seat-${i}`,
    seats: [{ regionId: `seat-${i}`, party: i % 3 === 0 ? 'labour' : 'conservative' }],
  }))
}

function councilWardPool(count: number): Region[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ward-${i}`,
    tier: 'council:district',
    name: `Ward ${i}`,
    geometryRef: `ward-${i}`,
    councilGeometryRef: 'council-1',
    councilName: 'Some Council',
    seats: [{ regionId: `ward-${i}`, party: 'labour' }],
  }))
}

describe('rollByElectionsForDay', () => {
  it('is deterministic for the same inputs', () => {
    const commons = commonsPool(650)
    const wards = councilWardPool(9000)
    const first = rollByElectionsForDay('2025-06-01', commons, wards, [])
    const second = rollByElectionsForDay('2025-06-01', commons, wards, [])
    expect(first).toEqual(second)
  })

  it('produces roughly 10 commons by-elections/year across a 650-seat pool', () => {
    const commons = commonsPool(650)
    let date = '2025-01-01'
    let contests: Contest[] = []
    for (let day = 0; day < 365; day++) {
      const rolled = rollByElectionsForDay(date, commons, [], contests)
      contests = [...contests, ...rolled]
      date = addDays(date, 1)
    }
    const commonsCount = contests.filter((c) => c.contestTier === 'commons').length
    expect(commonsCount).toBeGreaterThan(2)
    expect(commonsCount).toBeLessThan(25)
  })

  it('excludes a region still inside its cooldown window', () => {
    const commons = commonsPool(1)
    const existing: Contest[] = [
      {
        id: 'byelection:commons:seat-0:2025-01-01',
        contestTier: 'commons',
        regionId: 'seat-0',
        geometryRef: 'seat-0',
        seatName: 'Seat 0',
        incumbentParty: 'labour',
        calledDate: '2025-01-01',
        status: 'resolved',
      },
    ]
    const rolled = rollByElectionsForDay('2025-01-10', commons, [], existing)
    expect(rolled.filter((c) => c.regionId === 'seat-0')).toHaveLength(0)
  })

  it('tags ward contests with the parent council for map drill-down', () => {
    const wards = councilWardPool(1)
    // Force a contest by stacking the daily roll over many days deterministically until one lands.
    let date = '2025-01-01'
    let found: Contest | undefined
    for (let day = 0; day < 3650 && !found; day++) {
      const rolled = rollByElectionsForDay(date, [], wards, [])
      found = rolled[0]
      date = addDays(date, 1)
    }
    expect(found?.councilGeometryRef).toBe('council-1')
    expect(found?.seatName).toBe('Ward 0, Some Council')
  })
})

describe('startOfIsoWeek', () => {
  it('returns the Monday of the same week', () => {
    expect(startOfIsoWeek('2025-06-05')).toBe('2025-06-02') // Thursday -> Monday
    expect(startOfIsoWeek('2025-06-02')).toBe('2025-06-02') // already Monday
    expect(startOfIsoWeek('2025-06-08')).toBe('2025-06-02') // Sunday -> previous Monday
  })
})

describe('resolveContestAction', () => {
  function contest(overrides: Partial<Contest> = {}): Contest {
    return {
      id: 'byelection:commons:seat-0:2025-01-01',
      contestTier: 'commons',
      regionId: 'seat-0',
      geometryRef: 'seat-0',
      seatName: 'Seat 0',
      incumbentParty: 'conservative',
      calledDate: '2025-01-01',
      status: 'pending',
      ...overrides,
    }
  }

  it('ignore never produces a polling impact and keeps the incumbent label', () => {
    const result = resolveContestAction(contest(), 'ignore', 'labour')
    expect(result.pollingImpacts).toEqual([])
    expect(result.resultLabel).toBe('conservative hold')
  })

  it('is a no-op without a selected party', () => {
    const result = resolveContestAction(contest(), 'local_push', null)
    expect(result.pollingImpacts).toEqual([])
  })

  it('local_push queues exactly one polling impact for the acting party', () => {
    const result = resolveContestAction(contest(), 'local_push', 'labour')
    expect(result.pollingImpacts).toHaveLength(1)
    expect(result.pollingImpacts[0]).toMatchObject({ partyId: 'labour', source: 'byelection:byelection:commons:seat-0:2025-01-01:local_push' })
  })

  it('is deterministic for the same contest + action + party', () => {
    const first = resolveContestAction(contest(), 'nationalise', 'labour')
    const second = resolveContestAction(contest(), 'nationalise', 'labour')
    expect(first).toEqual(second)
  })
})

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
