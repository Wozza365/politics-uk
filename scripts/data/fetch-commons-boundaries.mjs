// Fetches current Westminster constituency boundaries (post-2023 boundary
// review) from the ONS Open Geography Portal and writes them as TopoJSON to
// src/data/scenarios/uk-2025-01-01/boundaries.commons.json, keyed by GSS code
// (matching Region.geometryRef, spec §4.2).
//
// Verified against the ONS Open Geography Portal (geoportal.statistics.gov.uk)
// item "Westminster Parliamentary Constituencies (July 2024) Boundaries UK BGC"
// (ArcGIS item id b49f0eeb2ce540f394831ba3a514d86e) — 650 features, maxRecordCount
// 2000 (single query, no pagination needed). Uses the BGC (20m generalised,
// clipped) layer rather than BFC for a smaller web payload; swap to the BFC
// service of the same name if more geometric detail is needed.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'

const ONS_FEATURE_SERVICE =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
  'Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC/FeatureServer/0/query'

async function main() {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'PCON24CD,PCON24NM',
    outSR: '4326',
    f: 'geojson',
  })

  const res = await fetch(`${ONS_FEATURE_SERVICE}?${params}`)
  if (!res.ok) {
    throw new Error(`ONS feature service request failed: ${res.status} ${res.statusText}`)
  }
  const geojson = await res.json()

  const collection = {
    type: 'FeatureCollection',
    features: geojson.features.map((f) => ({
      type: 'Feature',
      properties: {
        geometryRef: f.properties.PCON24CD,
        name: f.properties.PCON24NM,
      },
      geometry: f.geometry,
    })),
  }

  const topo = topology({ regions: collection })

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.commons.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(topo))
  console.log(`Wrote ${outPath} (${geojson.features.length} constituencies)`)
  console.log('Raw output is ~16MB; run `npm run data:simplify-boundaries` next to shrink it for the web (~600KB at 10% simplification).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
