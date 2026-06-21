import type { Topology } from 'topojson-specification'

/**
 * A boundary dataset for one tier/view: a TopoJSON topology plus which object
 * within it holds the region geometries.
 */
export interface BoundarySet {
  id: string // e.g. "commons-2025"
  topology: Topology
  objectKey: string // key within topology.objects to extract, e.g. "regions"
}

export interface RegionDisplayState {
  fill: string
  disabled?: boolean // greyed out, non-interactive (e.g. tier has no representation here)
  selected?: boolean
  label?: string
  tooltip?: Record<string, string | number | undefined>
  opacity?: number // e.g. dim every region except the active one
  liftPx?: number // raise this region above the rest of the (otherwise flat) map
}

/** Keyed by Region.geometryRef (spec §4.2) */
export type RegionState = Record<string, RegionDisplayState>

export interface MapRendererEvents {
  onRegionHover?: (geometryRef: string | null) => void
  onRegionClick?: (geometryRef: string) => void
}

/**
 * Backend-agnostic map drawing contract. The game logic and stores only ever
 * talk to this interface — never to SVG/Canvas/WebGL specifics — so a future
 * `TresMapRenderer` (real 3D, via TresJS) can replace `SvgMapRenderer` for a
 * single view with zero changes elsewhere (spec §9.1).
 */
export interface MapRenderer {
  mount(container: HTMLElement): void
  render(boundarySet: BoundarySet, regionState: RegionState): void
  setEvents(events: MapRendererEvents): void
  resize(): void
  unmount(): void
  /** Centre of a rendered region, in the same pixel space as the mount container's clientWidth/clientHeight (post-fit, pre-zoom). Null if not yet rendered. */
  getRegionCenter(geometryRef: string): { x: number; y: number } | null
}
