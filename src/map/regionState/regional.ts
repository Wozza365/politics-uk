import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import type { Region } from '@/types'
import type { RegionState } from '@/map/MapRenderer'
import { buildSeatRegionState, type SeatRegionStateContext } from './buildSeatRegionState'

const FILLER_FILL = '#d4d4d8'

// Regional view (P2.1): every geometryRef on boundaries.regional.json is
// either a real constituency from one of the four bodies (Holyrood/Senedd/
// NI Assembly/London Assembly) or England-outside-London filler with no
// matching region — filler renders disabled (greyed out, non-interactive)
// per the design decision recorded in docs/PHASE_2_PLAN.md's P2.1.
export function buildRegionalRegionState(
  regionalBoundaries: Topology,
  regionalRegionsByGeometryRef: Map<string, Region>,
  ctx: SeatRegionStateContext,
): RegionState {
  const state: RegionState = {}
  const collection = feature(
    regionalBoundaries,
    regionalBoundaries.objects.regions,
  ) as unknown as FeatureCollection<Geometry, { geometryRef: string }>
  for (const feat of collection.features) {
    const geometryRef = feat.properties.geometryRef
    const region = regionalRegionsByGeometryRef.get(geometryRef)
    state[geometryRef] = region ? buildSeatRegionState(region, ctx) : { fill: FILLER_FILL, disabled: true }
  }
  return state
}
