import { describe, expect, it } from 'vitest'
import { MAP_OVERLAY_VISUALS } from './visualState'

describe('map overlay visual contract', () => {
  it('keeps opponent and contest overlays distinguishable without colour alone', () => {
    expect(MAP_OVERLAY_VISUALS.opponentActivity.strokeDasharray).toBeTruthy()
    expect(MAP_OVERLAY_VISUALS.contests.strokeDasharray).toBeTruthy()
    expect(MAP_OVERLAY_VISUALS.opponentActivity.strokeDasharray).not.toBe(MAP_OVERLAY_VISUALS.contests.strokeDasharray)
  })

  it('keeps player commitments visually strongest enough to read over party fills', () => {
    expect(MAP_OVERLAY_VISUALS.commitments.strokeWidth).toBeGreaterThan(2)
    expect(MAP_OVERLAY_VISUALS.commitments.strokeDasharray).toBeUndefined()
  })
})
