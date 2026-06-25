import type { BoundarySet, MapRenderer, MapRendererEvents, RegionState } from './MapRenderer'
import { isHexBoundarySet } from './MapRenderer'

const NS = 'http://www.w3.org/2000/svg'
const PADDING_PX = 16
const HEX_GAP_RATIO = 0.08

type Bounds = { x: number; y: number; width: number; height: number }
type BuiltFor = { boundarySetId: string; width: number; height: number }

export class HexMapRenderer implements MapRenderer {
  private container: HTMLElement | null = null
  private svg: SVGSVGElement | null = null
  private polygons: Map<string, SVGPolygonElement> = new Map()
  private regionBounds: Map<string, Bounds> = new Map()
  private sizeExtent: { min: number; max: number } | null = null
  private events: MapRendererEvents = {}
  private builtFor: BuiltFor | null = null

  mount(container: HTMLElement): void {
    this.container = container
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.style.display = 'block'
    svg.style.transition = 'filter 300ms ease'
    container.replaceChildren(svg)
    this.svg = svg
    this.builtFor = null
  }

  render(boundarySet: BoundarySet, regionState: RegionState): void {
    if (!this.svg || !this.container || !isHexBoundarySet(boundarySet)) return

    const width = this.container.clientWidth || 800
    const height = this.container.clientHeight || 600
    const needsRebuild =
      !this.builtFor ||
      this.builtFor.boundarySetId !== boundarySet.id ||
      this.builtFor.width !== width ||
      this.builtFor.height !== height

    if (needsRebuild) {
      this.buildHexes(boundarySet, width, height, regionState)
      this.builtFor = { boundarySetId: boundarySet.id, width, height }
      return
    }

    for (const [geometryRef, polygon] of this.polygons) {
      this.applyStyle(polygon, regionState[geometryRef])
    }
  }

  setEvents(events: MapRendererEvents): void {
    this.events = events
  }

  resize(): void {
    // render() observes container size and rebuilds on the next draw.
  }

  unmount(): void {
    this.svg?.replaceChildren()
    this.container = null
    this.svg = null
    this.polygons.clear()
    this.regionBounds.clear()
    this.sizeExtent = null
    this.builtFor = null
  }

  getRegionBounds(geometryRef: string): Bounds | null {
    return this.regionBounds.get(geometryRef) ?? null
  }

  getRegionSizeExtent(): { min: number; max: number } | null {
    return this.sizeExtent
  }

  setBackgroundBlur(blurPx: number | null): void {
    if (!this.svg) return
    this.svg.style.filter = blurPx != null ? `blur(${blurPx}px)` : ''
  }

  private buildHexes(
    boundarySet: Extract<BoundarySet, { type: 'hex-layout' }>,
    width: number,
    height: number,
    regionState: RegionState,
  ): void {
    if (!this.svg) return

    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    this.svg.replaceChildren()
    this.polygons.clear()
    this.regionBounds.clear()

    if (boundarySet.hexes.length === 0) {
      this.sizeExtent = null
      return
    }

    const rawMinX = Math.min(...boundarySet.hexes.map((hex) => hex.x))
    const rawMaxX = Math.max(...boundarySet.hexes.map((hex) => hex.x))
    const rawMinY = Math.min(...boundarySet.hexes.map((hex) => hex.y))
    const rawMaxY = Math.max(...boundarySet.hexes.map((hex) => hex.y))
    const rawWidth = Math.max(rawMaxX - rawMinX, 1)
    const rawHeight = Math.max(rawMaxY - rawMinY, 1)
    const scale = Math.min(
      (width - PADDING_PX * 2) / rawWidth,
      (height - PADDING_PX * 2) / rawHeight,
    )
    const offsetX = (width - rawWidth * scale) / 2
    const offsetY = (height - rawHeight * scale) / 2
    const sortedX = [...new Set(boundarySet.hexes.map((hex) => hex.x))].sort((a, b) => a - b)
    const rawStep = sortedX
      .slice(1)
      .reduce((min, x, index) => Math.min(min, Math.abs(x - sortedX[index])), Infinity)
    const radius = (Number.isFinite(rawStep) ? rawStep * scale * 0.5 : 10) * (1 - HEX_GAP_RATIO)

    let minDiagonal = Infinity
    let maxDiagonal = -Infinity

    for (const hex of boundarySet.hexes) {
      const cx = offsetX + (hex.x - rawMinX) * scale
      const cy = offsetY + (rawMaxY - hex.y) * scale
      const polygon = document.createElementNS(NS, 'polygon')
      polygon.setAttribute('points', this.hexPoints(cx, cy, radius))
      polygon.setAttribute('stroke-linejoin', 'round')
      this.applyStyle(polygon, regionState[hex.geometryRef])

      const state = regionState[hex.geometryRef]
      if (!state?.disabled) {
        polygon.addEventListener('mouseenter', () => this.events.onRegionHover?.(hex.geometryRef))
        polygon.addEventListener('mouseleave', () => this.events.onRegionHover?.(null))
        polygon.addEventListener('click', () => this.events.onRegionClick?.(hex.geometryRef))
      }

      this.svg.appendChild(polygon)
      this.polygons.set(hex.geometryRef, polygon)
      const bounds = {
        x: cx - radius,
        y: cy - (Math.sqrt(3) / 2) * radius,
        width: radius * 2,
        height: Math.sqrt(3) * radius,
      }
      this.regionBounds.set(hex.geometryRef, bounds)
      const diagonal = Math.hypot(bounds.width, bounds.height)
      minDiagonal = Math.min(minDiagonal, diagonal)
      maxDiagonal = Math.max(maxDiagonal, diagonal)
    }

    this.sizeExtent = Number.isFinite(minDiagonal) ? { min: minDiagonal, max: maxDiagonal } : null
  }

  private hexPoints(cx: number, cy: number, radius: number): string {
    return Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 180) * (60 * index)
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`
    }).join(' ')
  }

  private applyStyle(polygon: SVGPolygonElement, state: RegionState[string] | undefined): void {
    const strokeWidth = state?.selected ? state.selectedStrokeWidth ?? 2 : state?.strokeWidth ?? 0.5
    const fill = state?.disabled ? '#d4d4d8' : state?.fill ?? '#9ca3af'
    polygon.setAttribute('fill', fill)
    polygon.setAttribute('stroke', strokeWidth <= 0 ? (state?.disabled ? fill : 'none') : '#1f2937')
    polygon.setAttribute('stroke-width', String(strokeWidth <= 0 && state?.disabled ? 0.75 : strokeWidth))
    polygon.style.cursor = state?.disabled ? 'default' : 'pointer'
    polygon.style.pointerEvents = state?.disabled ? 'none' : 'auto'
    polygon.style.opacity = state?.opacity != null ? String(state.opacity) : ''
    polygon.style.transformBox = 'fill-box'
    polygon.style.transformOrigin = 'center'
    polygon.style.transition = 'transform 400ms ease-out, filter 400ms ease-out'
    polygon.style.transform = state?.liftPx ? `translateY(-${state.liftPx}px)` : ''
    polygon.style.filter = state?.liftPx ? `drop-shadow(0 ${2 + state.liftPx}px 3px rgb(0 0 0 / 0.45))` : ''
  }
}
