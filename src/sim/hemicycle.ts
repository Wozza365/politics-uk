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
}

/**
 * Compute hemicycle layout for dots.
 *
 * @param totalSeats - total number of seats (e.g., 650 for Commons)
 * @param seatsPerDot - how many seats each dot represents (e.g., 1 for Commons, 10 for large tiers)
 * @returns dimensions and row data for rendering
 */
export function computeHemicycleLayout(totalSeats: number, seatsPerDot: number = 1) {
  const dotCount = Math.ceil(totalSeats / seatsPerDot)

  // Hemicycle arc spans 180 degrees (π radians), centered horizontally
  // Target ~12 dots per row for legibility, distributing across concentric semicircles
  const dotsPerRow = Math.max(12, Math.ceil(Math.sqrt(dotCount / 3)))

  const rows: HemicycleRow[] = []
  let dotsPlaced = 0

  for (let rowIndex = 0; dotsPlaced < dotCount; rowIndex++) {
    // Radius increases linearly with row index
    const radius = 40 + rowIndex * 35
    // Dots per row increases slightly in outer rows to fill the arc
    const seatsInThisRow = Math.min(dotsPerRow + rowIndex * 2, dotCount - dotsPlaced)
    const arcLength = Math.PI // 180 degrees

    rows.push({
      radius,
      seatsInRow: seatsInThisRow,
      startAngle: 0,
      endAngle: arcLength,
    })

    dotsPlaced += seatsInThisRow
  }

  return { rows, dotCount }
}

/**
 * Generate hemicycle dot positions (x, y) for a given seat index.
 * Arc spans from -90° to +90° (left to right across the bottom of a circle).
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
  // Angle: from -90° (left) to +90° (right), centered at bottom
  const angleRange = row.endAngle - row.startAngle
  const angleStep = angleRange / (row.seatsInRow - 1 || 1)
  const angle = row.startAngle + angleStep * seatInRow

  // Convert polar (radius, angle) to Cartesian coordinates
  // Center the hemicycle horizontally and vertically
  const centerX = viewportWidth / 2
  const centerY = viewportHeight

  const x = centerX + row.radius * Math.cos(angle - Math.PI / 2)
  const y = centerY - row.radius * Math.sin(angle - Math.PI / 2)

  return { x, y }
}
