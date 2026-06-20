// Builds a synthetic placeholder boundary fixture so the SvgMapRenderer
// pipeline can be exercised end-to-end before real ONS boundary data is
// available in this environment (see src/data/scenarios/uk-2025-01-01/README.md).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'

const seatNames = [
  'Sample Seat A',
  'Sample Seat B',
  'Sample Seat C',
  'Sample Seat D',
  'Sample Seat E',
  'Sample Seat F',
]

const cols = 3
const cellSize = 10

const features = seatNames.map((name, i) => {
  const col = i % cols
  const row = Math.floor(i / cols)
  const x0 = col * cellSize
  const y0 = row * cellSize
  const geometryRef = `placeholder-${i + 1}`
  return {
    type: 'Feature',
    properties: { geometryRef, name },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [x0, y0],
          [x0 + cellSize, y0],
          [x0 + cellSize, y0 + cellSize],
          [x0, y0 + cellSize],
          [x0, y0],
        ],
      ],
    },
  }
})

const collection = { type: 'FeatureCollection', features }
const topo = topology({ regions: collection })

const outPath = fileURLToPath(
  new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.placeholder.json', import.meta.url),
)
writeFileSync(outPath, JSON.stringify(topo))
console.log(`Wrote ${outPath}`)
