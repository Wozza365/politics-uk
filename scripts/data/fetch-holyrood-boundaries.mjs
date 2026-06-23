// Fetches Scottish Parliament constituency boundaries (the 73
// constituency-level seats; the 8 wider electoral regions used for the list
// vote are not fetched as geometry — the map only needs constituency-level
// shapes) from the ONS Open Geography Portal and writes them as TopoJSON to
// src/data/scenarios/uk-2025-01-01/boundaries.holyrood.json, keyed by GSS
// code (matching Region.geometryRef, spec §4.2).
//
// Verified against the ONS Open Geography Portal (geoportal.statistics.gov.uk)
// item "Scottish Parliamentary Constituencies (May 2021) Boundaries SC BGC"
// (ArcGIS item id 09aa7ef9896e459e88ee47ab593bbec3) — 73 features,
// maxRecordCount 1000 (single query, no pagination needed). These are the
// boundaries used for the 2021 Holyrood election and remain in force as of
// 2025-01-01; the next boundary review (SPC_MAY_2026_SC_*) only takes effect
// for the May 2026 election. Uses the BGC (20m generalised, clipped) layer
// rather than BFC for a smaller web payload, mirroring fetch-commons-boundaries.mjs.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'

const ONS_FEATURE_SERVICE =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
  'Scottish_Parliamentary_Constituencies_May_2021_Boundaries_SC_BGC/FeatureServer/0/query'

async function main() {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'SPC21CD,SPC21NM',
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
        geometryRef: f.properties.SPC21CD,
        name: f.properties.SPC21NM,
      },
      geometry: f.geometry,
    })),
  }

  const topo = topology({ regions: collection })

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.holyrood.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(topo))
  console.log(`Wrote ${outPath} (${geojson.features.length} constituencies)`)
  console.log('Run mapshaper directly afterwards to simplify for web payload size, e.g.:')
  console.log('  npx mapshaper src/data/scenarios/uk-2025-01-01/boundaries.holyrood.json -simplify 10% keep-shapes -o format=topojson force src/data/scenarios/uk-2025-01-01/boundaries.holyrood.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
