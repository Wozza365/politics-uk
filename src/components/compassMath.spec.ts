import { describe, expect, it } from 'vitest'
import { compassToCoords, radiusFromConsistency } from './compassMath'

describe('compassToCoords', () => {
  it('maps the origin (0,0) to the centre of the plane', () => {
    expect(compassToCoords({ economic: 0, social: 0 }, 100)).toEqual({ x: 50, y: 50 })
  })

  it('maps far-right/authoritarian (+1,+1) to the top-right corner', () => {
    expect(compassToCoords({ economic: 1, social: 1 }, 100)).toEqual({ x: 100, y: 0 })
  })

  it('maps far-left/libertarian (-1,-1) to the bottom-left corner', () => {
    expect(compassToCoords({ economic: -1, social: -1 }, 100)).toEqual({ x: 0, y: 100 })
  })
})

describe('radiusFromConsistency', () => {
  it('returns the max radius at consistency 0 (least consistent)', () => {
    expect(radiusFromConsistency(0, 20)).toBe(20)
  })

  it('returns the min radius (default 0) at consistency 1 (fully consistent)', () => {
    expect(radiusFromConsistency(1, 20)).toBe(0)
  })

  it('interpolates linearly at consistency 0.5', () => {
    expect(radiusFromConsistency(0.5, 20)).toBe(10)
  })

  it('respects a non-zero minRadius floor', () => {
    expect(radiusFromConsistency(1, 20, 4)).toBe(4)
    expect(radiusFromConsistency(0, 20, 4)).toBe(20)
  })

  it('clamps out-of-range consistency values', () => {
    expect(radiusFromConsistency(-1, 20)).toBe(20)
    expect(radiusFromConsistency(2, 20)).toBe(0)
  })
})
