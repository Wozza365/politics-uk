import type { Topology } from 'topojson-specification'

/**
 * A boundary dataset for one tier/view: a TopoJSON topology plus which object
 * within it holds the region geometries.
 */
export interface GeographicBoundarySet {
  id: string // e.g. "commons-2025"
  type?: 'topology'
  topology: Topology
  objectKey: string // key within topology.objects to extract, e.g. "regions"
  coordinateSystem?: 'bng' | 'lonlat'
  /**
   * Optional object to use only for projection fitting. This lets a focused
   * layer render a small subset while retaining the same whole-map frame.
   */
  fitTopology?: Topology
  fitObjectKey?: string
  fitCoordinateSystem?: 'bng' | 'lonlat'
  /** Optional non-interactive geography rendered behind the primary layer. */
  backgroundTopology?: Topology
  backgroundObjectKey?: string
  backgroundCoordinateSystem?: 'bng' | 'lonlat'
  backgroundStrokeWidth?: number
}

export interface HexLayoutEntry {
  geometryRef: string
  name?: string
  x: number
  y: number
}

/**
 * A schematic hex layout for one tier/view. Unlike GeographicBoundarySet,
 * this is not a geographic topology: each region is represented by a fixed
 * layout point and rendered as an equal-size hex.
 */
export interface HexBoundarySet {
  id: string
  type: 'hex-layout'
  orientation?: 'pointy'
  hexes: HexLayoutEntry[]
}

export type BoundarySet = GeographicBoundarySet | HexBoundarySet

export function isHexBoundarySet(boundarySet: BoundarySet): boundarySet is HexBoundarySet {
  return boundarySet.type === 'hex-layout'
}

export interface RegionDisplayState {
  fill: string
  disabled?: boolean // greyed out, non-interactive (e.g. tier has no representation here)
  selected?: boolean
  label?: string
  tooltip?: Record<string, string | number | undefined>
  opacity?: number // e.g. dim every region except the active one
  liftPx?: number // raise this region above the rest of the (otherwise flat) map
  strokeWidth?: number
  selectedStrokeWidth?: number
  /** Non-colour cue for overlay states such as contests or opponent activity. */
  strokeDasharray?: string
  /** P3.4 map overlays — overrides the default border colour to mark a region as targeted/
   * contested/opponent-active, without touching `fill` (which still encodes seat-holder colour). */
  strokeColor?: string
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
  /** Bounding box of a rendered region, in the same pixel space as the mount container's clientWidth/clientHeight (post-fit, pre-zoom). Null if not yet rendered. */
  getRegionBounds(geometryRef: string): { x: number; y: number; width: number; height: number } | null
  /** Min/max bounding-box diagonal (pixels, pre-zoom) across all currently rendered regions. Null if not yet rendered. */
  getRegionSizeExtent(): { min: number; max: number } | null
  /**
   * Blur every region except whichever one is currently lifted/active. Used
   * to mask GPU-compositing artifacts (soft edges, transient colour shifts)
   * that show up on the ~650-path background during the zoom/tilt snap
   * transition; pass `null` to remove it once the transition has settled.
   */
  setBackgroundBlur(blurPx: number | null): void
}
