// Fetches the 14 London Assembly constituency boundaries from the ONS Open
// Geography Portal and writes them as TopoJSON to
// src/data/scenarios/uk-2025-01-01/boundaries.london_assembly.json, keyed by
// GSS code (matching Region.geometryRef, spec §4.2).
//
// Verified against the ONS Open Geography Portal (geoportal.statistics.gov.uk)
// item "London Assembly Constituencies (December 2018) Boundaries EN BGC"
// (ArcGIS item id 53e0b95f4eb841e99ddd8e4b6342b172) — 14 features,
// maxRecordCount 2000 (single query, no pagination needed). This is the most
// recent *boundaries* layer ONS publishes for this geography; ONS has since
// published newer "Names and Codes" lookups (December 2021/2022/2023) for
// the same 14 constituencies, but no newer boundaries layer — the
// constituency areas themselves haven't changed since 2018, only the lookup
// edition. GSS codes (E32000001-E32000014) are stable across all editions.
// Uses the BGC (20m generalised, clipped) layer rather than BFC for a
// smaller web payload, matching fetch-commons-boundaries.mjs.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'

const ONS_FEATURE_SERVICE =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
  'London_Assembly_Constituencies_Dec_2018_GCB_EN_2022/FeatureServer/0/query'

async function main() {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'lac18cd,lac18nm',
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
        geometryRef: f.properties.lac18cd,
        name: f.properties.lac18nm,
      },
      geometry: f.geometry,
    })),
  }

  const topo = topology({ regions: collection })

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.london_assembly.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(topo))
  console.log(`Wrote ${outPath} (${geojson.features.length} constituencies)`)
  console.log('Run mapshaper directly to simplify for the web, e.g.:')
  console.log('  npx mapshaper src/data/scenarios/uk-2025-01-01/boundaries.london_assembly.json -simplify 10% keep-shapes -o format=topojson force src/data/scenarios/uk-2025-01-01/boundaries.london_assembly.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
