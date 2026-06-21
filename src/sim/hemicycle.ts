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

  // Hemicycle spans π radians (180°), centered horizontally at the bottom
  const arcAngle = Math.PI
  const minRadius = 30 // inner radius
  const maxRadius = 120 // outer radius to stay within UI bounds
  const radiusRange = maxRadius - minRadius

  // Calculate number of rows to distribute dots
  // Target ~18 dots per row at mid-radius for roughly consistent visual density
  const targetDotsPerRow = 18

  const numRows = Math.max(2, Math.ceil(dotCount / targetDotsPerRow))

  const rows: HemicycleRow[] = []
  let dotsPlaced = 0

  for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
    // Radius increases linearly from inner to outer
    const t = numRows > 1 ? rowIndex / (numRows - 1) : 0
    const radius = minRadius + t * radiusRange

    // Calculate arc length at this radius
    const arcLength = radius * arcAngle

    // Distribute remaining dots across remaining rows
    const dotsRemaining = dotCount - dotsPlaced
    const rowsRemaining = numRows - rowIndex

    // Scale dots per row by the arc length to maintain visual density
    // Outer rows have larger circumference, so they fit more dots at the same density
    const seatsInThisRow = Math.ceil(dotsRemaining / rowsRemaining)

    rows.push({
      radius,
      seatsInRow: seatsInThisRow,
      startAngle: 0,
      endAngle: arcAngle,
      arcLength,
    })

    dotsPlaced += seatsInThisRow
  }

  return { rows, dotCount }
}

/**
 * Generate hemicycle dot positions (x, y) for a given seat index.
 * Arc spans from 0° to 180° (left to right across the bottom of a circle).
 *
 * @param seatIndex - seat number (0-indexed)
 * @param rows - row layout data from computeHemicycleLayout
 * @param viewportWidth - width of the SVG viewport
 * @param viewportHeight - height of the SVG viewport
 * @returns { x, y } coordinates for the dot
 */
export function getHemicycleDotPosition(
  seatIndex: number,
  rows: HemicycleRow[],
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  let rowIndex = 0
  let seatInRow = seatIndex

  // Find which row this seat belongs to
  for (let i = 0; i < rows.length; i++) {
    if (seatInRow < rows[i].seatsInRow) {
      rowIndex = i
      break
    }
    seatInRow -= rows[i].seatsInRow
  }

  const row = rows[rowIndex]
  // Angle: from 0° (left) to π (right), centered at bottom
  const angleRange = row.endAngle - row.startAngle
  const angleStep = angleRange / Math.max(row.seatsInRow - 1, 1)
  const angle = row.startAngle + angleStep * seatInRow

  // Convert polar (radius, angle) to Cartesian coordinates
  // Center the hemicycle horizontally and at the bottom of viewport
  const centerX = viewportWidth / 2
  const centerY = viewportHeight

  // angle 0 = left, π = right; we want angle π/2 = top
  const x = centerX + row.radius * Math.sin(angle)
  const y = centerY - row.radius * Math.cos(angle)

  return { x, y }
}
