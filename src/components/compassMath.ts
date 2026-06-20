// Pure math helpers for CompassView.vue, extracted so the position/radius
// mapping is unit-testable without mounting the component (spec §4.4).
import type { CompassPosition } from '@/types'

export interface PlaneCoords {
  x: number
  y: number
}

/**
 * Maps a compass position (economic -1..+1, social -1..+1, where social +1 is
 * "authoritarian") onto plane pixel coordinates within a `size`x`size` square,
 * with (0,0) at the top-left. Economic right is the data convention's +1
 * (right), so it maps left-to-right as-is. Social maps "authoritarian" (+1) to
 * the top of the plane and "libertarian" (-1) to the bottom, matching the
 * conventional political-compass chart orientation.
 */
export function compassToCoords(position: CompassPosition, size: number): PlaneCoords {
  const half = size / 2
  const x = half + position.economic * half
  const y = half - position.social * half
  return { x, y }
}

/**
 * Maps consistency (0..1, where 1 = fully consistent) to a circle radius:
 * higher consistency -> smaller/tighter circle. `maxRadius` is the radius at
 * consistency 0; `minRadius` is the floor at consistency 1 (so even a perfectly
 * consistent stance/party still renders a visible dot).
 */
export function radiusFromConsistency(
  consistency: number,
  maxRadius: number,
  minRadius = 0,
): number {
  const clamped = Math.min(1, Math.max(0, consistency))
  return minRadius + (1 - clamped) * (maxRadius - minRadius)
}
