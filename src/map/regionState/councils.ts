import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import type { Region } from '@/types'
import type { RegionState } from '@/map/MapRenderer'
import type { SeatRegionStateContext } from './buildSeatRegionState'

export type CouncilBoundaryCollection = FeatureCollection<Geometry, { geometryRef: string }>

const DISABLED_FILL = '#d4d4d8'
const UNHELD_FILL = '#9ca3af'

export function councilBoundaryCollection(
  councilBoundaries: Topology,
  objectKey: string,
  cache: Map<string, CouncilBoundaryCollection>,
) {
  const cached = cache.get(objectKey)
  if (cached) return cached
  const collection = feature(councilBoundaries, councilBoundaries.objects[objectKey]) as unknown as CouncilBoundaryCollection
  cache.set(objectKey, collection)
  return collection
}

export function buildCouncilRegionState(
  councilBoundaries: Topology,
  objectKey: string,
  regionsByGeometryRef: Map<string, Region>,
  ctx: SeatRegionStateContext,
  cache: Map<string, CouncilBoundaryCollection>,
): RegionState {
  const state: RegionState = {}
  const collection = councilBoundaryCollection(councilBoundaries, objectKey, cache)

  for (const feat of collection.features) {
    const geometryRef = feat.properties.geometryRef
    const region = regionsByGeometryRef.get(geometryRef)
    if (!region) {
      state[geometryRef] = { fill: DISABLED_FILL, disabled: true, strokeWidth: 0, selectedStrokeWidth: 0 }
      continue
    }
    const controlParty = region.control?.party
    const isActiveRegion = ctx.activeGeometryRef === geometryRef
    state[geometryRef] = {
      fill: controlParty ? ctx.partyColour(controlParty) : UNHELD_FILL,
      selected: ctx.hoveredGeometryRef === geometryRef,
      strokeWidth: 0.35,
      selectedStrokeWidth: 1.15,
      opacity: ctx.activeGeometryRef !== null && !isActiveRegion ? 0.38 : undefined,
      liftPx: isActiveRegion ? ctx.liftPx : undefined,
      tooltip: {
        name: region.name,
        party: controlParty ? ctx.partyName(controlParty) : region.control?.label,
      },
    }
  }
  return state
}

export function buildCouncilWardRegionState(
  wardRegions: Region[],
  ctx: SeatRegionStateContext,
): RegionState {
  const state: RegionState = {}

  for (const ward of wardRegions) {
    const partyId = ward.control?.party ?? ward.seats[0]?.party
    state[ward.geometryRef] = {
      fill: partyId ? ctx.partyColour(partyId) : UNHELD_FILL,
      selected: ctx.hoveredGeometryRef === ward.geometryRef,
      strokeWidth: 0.35,
      selectedStrokeWidth: 1.15,
      tooltip: {
        name: ward.name,
        party: partyId ? ctx.partyName(partyId) : undefined,
      },
    }
  }

  return state
}
