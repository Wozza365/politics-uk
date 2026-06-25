import type { Region } from '@/types'
import type { RegionDisplayState } from '@/map/MapRenderer'

/** Shared selection/styling context every tier's region-state builder needs. */
export interface SeatRegionStateContext {
  partyColour: (partyId: string) => string
  partyName: (partyId: string) => string | undefined
  hoveredGeometryRef: string | null
  activeGeometryRef: string | null
  liftPx: number
}

const UNHELD_FILL = '#9ca3af'

/** Fill/selection/tooltip state for one region, by its current seat-holder (seats[0]). */
export function buildSeatRegionState(region: Region, ctx: SeatRegionStateContext): RegionDisplayState {
  const holder = region.seats[0]
  const isActiveRegion = ctx.activeGeometryRef === region.geometryRef
  return {
    fill: holder ? ctx.partyColour(holder.party) : UNHELD_FILL,
    selected: ctx.hoveredGeometryRef === region.geometryRef,
    strokeWidth: 0.1,
    selectedStrokeWidth: 0.2,
    opacity: ctx.activeGeometryRef !== null && !isActiveRegion ? 0.5 : undefined,
    liftPx: isActiveRegion ? ctx.liftPx : undefined,
    tooltip: {
      name: region.name,
      party: holder ? ctx.partyName(holder.party) : undefined,
      member: holder?.memberName,
    },
  }
}
