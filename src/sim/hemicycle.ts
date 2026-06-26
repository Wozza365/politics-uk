/**
 * Hemicycle layout algorithm for parliamentary seat visualization.
 * Distributes seats across concentric rows of a hemicycle arc.
 */

export interface HemicycleDot {
  id: string
  partyId: string
  x: number
  y: number
  seatIndex: number
}

export interface HemicycleRow {
  radius: number
  seatsInRow: number
  startAngle: number
  endAngle: number
  arcLength: number
}

/**
 * Compute hemicycle layout for dots.
 * Distributes `totalSeats / seatsPerDot` dots across concentric semicircular rows,
 * maintaining roughly constant visual density across all rows.
 *
 * @param totalSeats - total number of seats (e.g., 650 for Commons)
 * @param seatsPerDot - how many seats each dot represents (e.g., 1 for Commons, 10 for large tiers)
 * @returns dimensions and row data for rendering
 */
export function computeHemicycleLayout(totalSeats: number, seatsPerDot: number = 1) {
  const dotCount = Math.ceil(totalSeats / seatsPerDot)

  // A full semicircle (180°), symmetric about the upward vertical (straight
  // up = the centre of the fan).
  const arcAngle = Math.PI
  const minRadius = 42.3046875 // inner radius (another 5% closer in)
  const maxRadius = 169.21875 // outer radius (another 5% closer in)
  const radiusRange = maxRadius - minRadius

  // Target ~18 dots on the innermost ring; every ring's dot count then scales
  // with its arc length (radius), so dot spacing stays roughly constant from
  // the centre outwards instead of every ring getting an even share.
  const targetInnerRowDots = 18
  const numRows = Math.max(2, Math.ceil(dotCount / (targetInnerRowDots * 2)))

  // First pass: each row's *ideal* (fractional) seat count, proportional to
  // its radius (arc length at constant angular span).
  const radii: number[] = []
  for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
    const t = numRows > 1 ? rowIndex / (numRows - 1) : 0
    radii.push(minRadius + t * radiusRange)
  }
  const radiusSum = radii.reduce((sum, r) => sum + r, 0)

  // Second pass: round each row's share down (floor at 1, so even the
  // smallest inner ring is drawable), then hand out the leftover dots (from
  // rounding) to the outermost rows first, since they're the ones with the
  // most room.
  const baseCounts = radii.map((r) => Math.max(1, Math.floor((dotCount * r) / radiusSum)))
  const assigned = baseCounts.reduce((sum, c) => sum + c, 0)
  let remainder = dotCount - assigned
  for (let rowIndex = numRows - 1; rowIndex >= 0 && remainder > 0; rowIndex--) {
    baseCounts[rowIndex]++
    remainder--
  }
  // If rounding up to the per-row minimum overshot the total (only possible
  // with a very small dotCount spread across many rows), trim back from the
  // innermost rows so the dot total still matches exactly.
  let overshoot = assigned - dotCount
  for (let rowIndex = 0; rowIndex < numRows && overshoot > 0; rowIndex++) {
    if (baseCounts[rowIndex] > 1) {
      baseCounts[rowIndex]--
      overshoot--
    }
  }

  const rows: HemicycleRow[] = radii.map((radius, rowIndex) => ({
    radius,
    seatsInRow: baseCounts[rowIndex],
    startAngle: -arcAngle / 2,
    endAngle: arcAngle / 2,
    arcLength: radius * arcAngle,
  }))

  return { rows, dotCount }
}

/** One drawable dot position before a party is assigned to it. */
export interface HemicycleSlot {
  radius: number
  angle: number
}

export interface HouseSlot {
  x: number
  y: number
  row: number
  column: number
}

/**
 * Flatten every row into individual dot slots, sorted by angle ascending
 * (left → right, i.e. clockwise across the fan), then by radius ascending
 * as a tiebreak for slots that land at the same angle in different rows.
 *
 * This ordering is what lets callers fill the hemicycle by sweeping
 * clockwise across the whole fan (assigning contiguous wedges to parties)
 * rather than filling one ring fully before moving to the next.
 */
export function buildHemicycleSlots(rows: HemicycleRow[]): HemicycleSlot[] {
  const slots: HemicycleSlot[] = []

  for (const row of rows) {
    const angleRange = row.endAngle - row.startAngle
    const angleStep = angleRange / Math.max(row.seatsInRow - 1, 1)
    for (let i = 0; i < row.seatsInRow; i++) {
      slots.push({ radius: row.radius, angle: row.startAngle + angleStep * i })
    }
  }

  slots.sort((a, b) => a.angle - b.angle || a.radius - b.radius)
  return slots
}

/**
 * Convert a hemicycle slot (radius, angle) to SVG (x, y).
 * Angle 0 = straight up; positive angle = right, negative = left.
 *
 * @param viewportWidth - width of the SVG viewport
 * @param viewportHeight - height of the SVG viewport
 */
export function slotToPosition(
  slot: HemicycleSlot,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const centerX = viewportWidth / 2
  const centerY = viewportHeight - 5 // nudged up 5px

  const x = centerX + slot.radius * Math.sin(slot.angle)
  const y = centerY - slot.radius * Math.cos(slot.angle)

  return { x, y }
}

/**
 * Compute a compact rows-of-benches layout for the alternate "house" view.
 * Slots are filled left-to-right, top-to-bottom so callers can keep the same
 * party ordering as the fan while giving players a flatter grid-like read.
 */
export function computeHouseSlots(
  dotCount: number,
  viewportWidth: number,
  viewportHeight: number,
  dotRadius: number,
): HouseSlot[] {
  if (dotCount <= 0) return []

  const horizontalPadding = 36
  const verticalPadding = 28
  const minGap = dotRadius * 2.8
  const usableWidth = Math.max(minGap, viewportWidth - horizontalPadding * 2)
  const usableHeight = Math.max(minGap, viewportHeight - verticalPadding * 2)
  const columns = Math.max(1, Math.ceil(Math.sqrt((dotCount * usableWidth) / usableHeight)))
  const rows = Math.ceil(dotCount / columns)
  const columnGap = columns > 1 ? usableWidth / (columns - 1) : 0
  const rowGap = rows > 1 ? usableHeight / (rows - 1) : 0
  const firstX = columns > 1 ? horizontalPadding : viewportWidth / 2
  const firstY = rows > 1 ? verticalPadding : viewportHeight / 2

  return Array.from({ length: dotCount }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const dotsInRow = Math.min(columns, dotCount - row * columns)
    const rowWidth = (dotsInRow - 1) * columnGap
    const rowStartX = dotsInRow > 1 ? viewportWidth / 2 - rowWidth / 2 : viewportWidth / 2

    return {
      x: dotsInRow === columns ? firstX + column * columnGap : rowStartX + column * columnGap,
      y: firstY + row * rowGap,
      row,
      column,
    }
  })
}
