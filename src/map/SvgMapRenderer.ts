import { geoIdentity, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type {
  BoundarySet,
  MapRenderer,
  MapRendererEvents,
  RegionState,
} from './MapRenderer'

const NS = 'http://www.w3.org/2000/svg'

// Shared with the "raised map" whole-map drop-shadow in MapView so a lifted
// region's own edge (depth = base depth + lift) lines up with the rest of
// the map's ground line instead of looking like it floats at a different
// base height.
export const RAISED_EDGE_DEPTH_PX = 2
export const RAISED_EDGE_COLOR = '#3f3f46'

/**
 * MVP `MapRenderer` backend: plain SVG via d3-geo + topojson-client.
 * Projection-free (`geoIdentity`) since boundary sources are pre-projected
 * British National Grid / WGS84 shapes — fit to the viewBox on render.
 */
export class SvgMapRenderer implements MapRenderer {
  private container: HTMLElement | null = null
  private svg: SVGSVGElement | null = null
  private paths: Map<string, SVGPathElement> = new Map()
  private events: MapRendererEvents = {}
  // Tracks what the currently-built paths were fit to, so render() can tell
  // a real re-render (new dataset / resized container) apart from a pure
  // regionState change (e.g. hover highlighting) — the latter only needs to
  // touch a handful of attributes, not rebuild ~650 path geometries.
  private builtFor: { boundarySetId: string; width: number; height: number } | null = null
  // The lifted region is rendered in a *separate* <svg> overlay, not as one
  // of the ~650 paths in the main document. SVG filters are rasterized in
  // software, and a heavy multi-layer drop-shadow filter on a path sharing a
  // paint surface with 649 others forced the whole surface to be
  // re-rasterized (filter included) on every repaint of *any* of them — i.e.
  // on every hover transition, even with the filter value itself unchanged.
  // A separate SVG element gives the browser its own paint surface/layer for
  // it, decoupling its (expensive, rare) repaints from the main map's
  // (cheap, constant) ones.
  private overlaySvg: SVGSVGElement | null = null
  private overlayPath: SVGPathElement | null = null
  private liftedGeometryRef: string | null = null
  private liftedDepthPx = 0
  // Pixel-space bounds per region from the projection itself (geoPath.bounds),
  // not path.getBBox() — cheaper (no layout query) and unaffected by a path's
  // own CSS transform (e.g. an active region's lift). sizeExtent is the
  // min/max bounding-box diagonal across the whole dataset, computed in the
  // same pass, so callers can rank one region's size relative to all the
  // others (e.g. for size-proportional zoom).
  private regionBounds: Map<string, { x: number; y: number; width: number; height: number }> =
    new Map()
  private sizeExtent: { min: number; max: number } | null = null

  mount(container: HTMLElement): void {
    this.container = container
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.style.display = 'block'
    // Only the background blur (setBackgroundBlur) transitions — letting it
    // fade in/out is enough on its own to cover the snap's rendering
    // artifacts without needing to be in lockstep with the snap's duration.
    svg.style.transition = 'filter 300ms ease'

    const overlaySvg = document.createElementNS(NS, 'svg')
    overlaySvg.setAttribute('width', '100%')
    overlaySvg.setAttribute('height', '100%')
    overlaySvg.style.position = 'absolute'
    overlaySvg.style.inset = '0'
    overlaySvg.style.pointerEvents = 'none'

    const overlayPath = document.createElementNS(NS, 'path')
    overlayPath.setAttribute('stroke', '#1f2937')
    overlaySvg.appendChild(overlayPath)

    container.replaceChildren(svg, overlaySvg)
    this.svg = svg
    this.overlaySvg = overlaySvg
    this.overlayPath = overlayPath
    this.builtFor = null
    this.liftedGeometryRef = null
    this.liftedDepthPx = 0
  }

  setEvents(events: MapRendererEvents): void {
    this.events = events
  }

  render(boundarySet: BoundarySet, regionState: RegionState): void {
    if (!this.svg || !this.container) return

    const width = this.container.clientWidth || 800
    const height = this.container.clientHeight || 600

    const needsRebuild =
      !this.builtFor ||
      this.builtFor.boundarySetId !== boundarySet.id ||
      this.builtFor.width !== width ||
      this.builtFor.height !== height

    if (needsRebuild) {
      this.buildPaths(boundarySet, width, height, regionState)
      this.builtFor = { boundarySetId: boundarySet.id, width, height }
      return
    }

    // Geometry is already on screen and unchanged — only update the visual
    // attributes that regionState actually varies (fill/selection/disabled/
    // opacity), in place, with no DOM teardown/rebuild and no path
    // recomputation.
    for (const [geometryRef, path] of this.paths) {
      this.applyRoutineStyle(path, regionState[geometryRef])
    }
    this.syncLift(regionState)
  }

  private applyRoutineStyle(path: SVGPathElement, state: RegionState[string] | undefined): void {
    path.setAttribute('fill', state?.disabled ? '#d4d4d8' : state?.fill ?? '#9ca3af')
    path.setAttribute('stroke-width', state?.selected ? '2' : '0.5')
    path.style.cursor = state?.disabled ? 'default' : 'pointer'
    path.style.pointerEvents = state?.disabled ? 'none' : 'auto'
    path.style.opacity = state?.opacity != null ? String(state.opacity) : ''
  }

  // Moves the lift effect onto the overlay path (hiding the corresponding
  // main-document path so it doesn't double-render underneath), but only
  // touches the DOM when the lifted region/depth has actually changed since
  // the last call — see the comment by liftedGeometryRef for why.
  private syncLift(regionState: RegionState): void {
    let nextRef: string | null = null
    let nextState: RegionState[string] | null = null
    for (const [geometryRef, state] of Object.entries(regionState)) {
      if (state.liftPx) {
        nextRef = geometryRef
        nextState = state
        break
      }
    }
    const nextDepth = nextState ? RAISED_EDGE_DEPTH_PX + (nextState.liftPx ?? 0) : 0

    if (nextRef === this.liftedGeometryRef && nextDepth === this.liftedDepthPx) return

    if (this.liftedGeometryRef) {
      const previousMain = this.paths.get(this.liftedGeometryRef)
      if (previousMain) previousMain.style.display = ''
    }

    if (nextRef && nextState && this.overlayPath) {
      const mainPath = this.paths.get(nextRef)
      if (mainPath) {
        this.overlayPath.setAttribute('d', mainPath.getAttribute('d') ?? '')
        mainPath.style.display = 'none'
      }
      this.overlayPath.setAttribute('fill', nextState.fill)
      this.overlayPath.setAttribute('stroke-width', nextState.selected ? '2' : '0.5')
      this.overlayPath.style.pointerEvents = 'auto'
      this.overlayPath.style.cursor = 'pointer'
      this.overlayPath.style.transition = 'transform 400ms ease-out, filter 400ms ease-out'
      this.overlayPath.style.transform = `translate(0, -${nextState.liftPx}px)`
      // Deliberately minor: one small, soft shadow — just enough to read as
      // "slightly raised", not a solid extruded block/pedestal.
      this.overlayPath.style.filter = `drop-shadow(0 ${nextDepth}px 3px rgb(0 0 0 / 0.5))`
      this.overlayPath.onmouseenter = () => this.events.onRegionHover?.(nextRef)
      this.overlayPath.onmouseleave = () => this.events.onRegionHover?.(null)
      this.overlayPath.onclick = () => this.events.onRegionClick?.(nextRef)
    } else if (this.overlayPath) {
      this.overlayPath.removeAttribute('d')
      this.overlayPath.style.pointerEvents = 'none'
      this.overlayPath.style.transform = ''
      this.overlayPath.style.filter = ''
      this.overlayPath.style.transition = ''
      this.overlayPath.onmouseenter = null
      this.overlayPath.onmouseleave = null
      this.overlayPath.onclick = null
    }

    this.liftedGeometryRef = nextRef
    this.liftedDepthPx = nextDepth
  }

  private buildPaths(
    boundarySet: BoundarySet,
    width: number,
    height: number,
    regionState: RegionState,
  ): void {
    if (!this.svg) return

    const collection = feature(
      boundarySet.topology,
      boundarySet.topology.objects[boundarySet.objectKey],
    ) as unknown as FeatureCollection<Geometry, { geometryRef: string }>

    const projection = geoIdentity().reflectY(true).fitSize([width, height], collection)
    const pathGenerator = geoPath(projection)

    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    this.svg.replaceChildren()
    this.paths.clear()
    // Keep the overlay's coordinate space identical to the main map's so a
    // copied `d` attribute lands in exactly the same place.
    this.overlaySvg?.setAttribute('viewBox', `0 0 ${width} ${height}`)
    // The old DOM nodes are gone — forget which one was lifted so syncLift()
    // below re-applies it fresh to its replacement rather than skipping the
    // (now-stale) "nothing changed" check.
    this.liftedGeometryRef = null
    this.liftedDepthPx = 0
    this.regionBounds.clear()
    let minDiagonal = Infinity
    let maxDiagonal = -Infinity

    for (const f of collection.features) {
      const geometryRef = f.properties.geometryRef
      const state = regionState[geometryRef]

      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', pathGenerator(f as GeoPermissibleObjects) ?? '')
      path.setAttribute('stroke', '#1f2937')
      this.applyRoutineStyle(path, state)

      if (!state?.disabled) {
        path.addEventListener('mouseenter', () => this.events.onRegionHover?.(geometryRef))
        path.addEventListener('mouseleave', () => this.events.onRegionHover?.(null))
        path.addEventListener('click', () => this.events.onRegionClick?.(geometryRef))
      }

      this.svg.appendChild(path)
      this.paths.set(geometryRef, path)

      const [[x0, y0], [x1, y1]] = pathGenerator.bounds(f as GeoPermissibleObjects)
      const boundsWidth = x1 - x0
      const boundsHeight = y1 - y0
      this.regionBounds.set(geometryRef, { x: x0, y: y0, width: boundsWidth, height: boundsHeight })
      const diagonal = Math.hypot(boundsWidth, boundsHeight)
      minDiagonal = Math.min(minDiagonal, diagonal)
      maxDiagonal = Math.max(maxDiagonal, diagonal)
    }
    this.sizeExtent = Number.isFinite(minDiagonal) ? { min: minDiagonal, max: maxDiagonal } : null

    this.syncLift(regionState)
  }

  getRegionBounds(geometryRef: string): { x: number; y: number; width: number; height: number } | null {
    return this.regionBounds.get(geometryRef) ?? null
  }

  /** Min/max bounding-box diagonal (pixels, pre-zoom) across all currently rendered regions. */
  getRegionSizeExtent(): { min: number; max: number } | null {
    return this.sizeExtent
  }

  setBackgroundBlur(blurPx: number | null): void {
    if (!this.svg) return
    // Deliberately on the main <svg> only, not the overlaySvg the lifted/
    // active region renders on — that's the point: hide the background's
    // artifacts while the active region stays sharp.
    this.svg.style.filter = blurPx != null ? `blur(${blurPx}px)` : ''
  }

  resize(): void {
    // A no-op is no longer quite right now that render() caches by size —
    // but resize is driven by the browser's layout, and the next render()
    // call (e.g. the next hover event) already re-reads clientWidth/Height
    // and will detect the mismatch and rebuild, so there's still nothing to
    // do here explicitly.
  }

  unmount(): void {
    this.svg?.replaceChildren()
    this.paths.clear()
    this.regionBounds.clear()
    this.sizeExtent = null
    this.container = null
    this.svg = null
    this.overlaySvg = null
    this.overlayPath = null
  }
}
