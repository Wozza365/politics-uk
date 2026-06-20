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

  mount(container: HTMLElement): void {
    this.container = container
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.style.display = 'block'
    container.replaceChildren(svg)
    this.svg = svg
  }

  setEvents(events: MapRendererEvents): void {
    this.events = events
  }

  render(boundarySet: BoundarySet, regionState: RegionState): void {
    if (!this.svg || !this.container) return

    const collection = feature(
      boundarySet.topology,
      boundarySet.topology.objects[boundarySet.objectKey],
    ) as unknown as FeatureCollection<Geometry, { geometryRef: string }>

    const width = this.container.clientWidth || 800
    const height = this.container.clientHeight || 600
    const projection = geoIdentity().reflectY(true).fitSize([width, height], collection)
    const pathGenerator = geoPath(projection)

    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    this.svg.replaceChildren()
    this.paths.clear()

    for (const f of collection.features) {
      const geometryRef = f.properties.geometryRef
      const state = regionState[geometryRef]

      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', pathGenerator(f as GeoPermissibleObjects) ?? '')
      path.setAttribute('fill', state?.disabled ? '#d4d4d8' : state?.fill ?? '#9ca3af')
      path.setAttribute('stroke', '#1f2937')
      path.setAttribute('stroke-width', state?.selected ? '2' : '0.5')
      path.style.cursor = state?.disabled ? 'default' : 'pointer'
      path.style.pointerEvents = state?.disabled ? 'none' : 'auto'

      if (!state?.disabled) {
        path.addEventListener('mouseenter', () => this.events.onRegionHover?.(geometryRef))
        path.addEventListener('mouseleave', () => this.events.onRegionHover?.(null))
        path.addEventListener('click', () => this.events.onRegionClick?.(geometryRef))
      }

      this.svg.appendChild(path)
      this.paths.set(geometryRef, path)
    }
  }

  resize(): void {
    // viewBox scaling handles layout changes; re-render on next state push
    // recomputes the fit, so nothing to do for pure container resizes.
  }

  unmount(): void {
    this.svg?.replaceChildren()
    this.paths.clear()
    this.container = null
    this.svg = null
  }
}
