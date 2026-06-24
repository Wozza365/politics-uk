import type { Region } from '@/types'
import type { RegionState } from '@/map/MapRenderer'
import { buildSeatRegionState, type SeatRegionStateContext } from './buildSeatRegionState'

export function buildCommonsRegionState(regions: Region[], ctx: SeatRegionStateContext): RegionState {
  const state: RegionState = {}
  for (const region of regions) {
    state[region.geometryRef] = buildSeatRegionState(region, ctx)
  }
  return state
}
