import { describe, expect, it } from 'vitest'
import { nationalSwing, projectSeatsByParty } from './projection'
import type { Region } from '@/types'

function region(id: string, results: { party: string; voteShare: number }[]): Region {
  return {
    id,
    tier: 'commons',
    name: id,
    geometryRef: id,
    seats: [
      {
        regionId: id,
        party: results[0].party,
        results: results.map((r) => ({ ...r, votes: 0 })),
      },
    ],
  }
}

describe('nationalSwing', () => {
  it('is the per-party difference between current and start polling', () => {
    expect(nationalSwing({ labour: 40, conservative: 30 }, { labour: 35, conservative: 35 })).toEqual({
      labour: -5,
      conservative: 5,
    })
  })

  it('treats a party missing from either snapshot as 0', () => {
    expect(nationalSwing({ labour: 40 }, { labour: 40, reform: 15 })).toEqual({ labour: 0, reform: 15 })
  })
})

describe('projectSeatsByParty', () => {
  it('keeps the incumbent when there is no national swing', () => {
    const regions = [
      region('a', [
        { party: 'labour', voteShare: 45 },
        { party: 'conservative', voteShare: 35 },
      ]),
    ]
    const polling = { labour: 30, conservative: 30 }

    expect(projectSeatsByParty(regions, polling, polling)).toEqual({ labour: 1 })
  })

  it('flips a seat to the challenger once national swing overtakes the local gap', () => {
    const regions = [
      region('a', [
        { party: 'labour', voteShare: 40 },
        { party: 'conservative', voteShare: 35 },
      ]),
    ]
    // Labour down 10, Conservative up 10 nationally -> projected 30 vs 45, seat flips.
    const counts = projectSeatsByParty(regions, { labour: 40, conservative: 30 }, { labour: 30, conservative: 40 })

    expect(counts).toEqual({ conservative: 1 })
  })

  it('sums projected winners across many seats', () => {
    const regions = [
      region('a', [
        { party: 'labour', voteShare: 50 },
        { party: 'conservative', voteShare: 20 },
      ]),
      region('b', [
        { party: 'conservative', voteShare: 50 },
        { party: 'labour', voteShare: 20 },
      ]),
    ]
    const polling = { labour: 30, conservative: 30 }

    expect(projectSeatsByParty(regions, polling, polling)).toEqual({ labour: 1, conservative: 1 })
  })

  it('falls back to the recorded incumbent when a seat has no results breakdown', () => {
    const regions: Region[] = [
      { id: 'a', tier: 'commons', name: 'a', geometryRef: 'a', seats: [{ regionId: 'a', party: 'labour' }] },
    ]

    expect(projectSeatsByParty(regions, { labour: 40 }, { labour: 10 })).toEqual({ labour: 1 })
  })

  it('never projects a negative vote share for a party swinging hard down', () => {
    const regions = [
      region('a', [
        { party: 'labour', voteShare: 5 },
        { party: 'conservative', voteShare: 4 },
      ]),
    ]
    // Labour swings down 50 points -> floored at 0, not negative; still beats nothing else moving.
    const counts = projectSeatsByParty(regions, { labour: 55, conservative: 4 }, { labour: 5, conservative: 4 })

    expect(counts).toEqual({ conservative: 1 })
  })
})
