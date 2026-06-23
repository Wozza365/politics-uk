// Fetches the 40 Senedd constituency boundaries (the pre-2026 system — same
// 40 units as the old "National Assembly for Wales Constituencies", renamed
// to "Senedd Cymru Constituencies" after the Senedd's 2020 rename; NOT the
// larger 16-constituency system that takes effect from the 2026 election)
// from the ONS Open Geography Portal and writes them as TopoJSON to
// src/data/scenarios/uk-2025-01-01/boundaries.senedd.json, keyed by GSS code
// (matching Region.geometryRef, spec §4.2).
//
// Verified against the ONS Open Geography Portal (geoportal.statistics.gov.uk)
// item "Senedd Cymru Constituencies (December 2022) Boundaries WA BGC"
// (ArcGIS serviceItemId 674cff5363aa4af0bcd1e35fe35bfd9e) — 40 features,
// maxRecordCount 2000 (single query, no pagination needed). Uses the BGC
// (20m generalised, clipped) layer rather than BFE for a smaller web
// payload, mirroring fetch-commons-boundaries.mjs.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'

const ONS_FEATURE_SERVICE =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
  'Senedd_Cymru_Constituencies_December_2022_Boundaries_WA_BGC/FeatureServer/0/query'

async function main() {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'SENC22CD,SENC22NM',
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
        geometryRef: f.properties.SENC22CD,
        name: f.properties.SENC22NM,
      },
      geometry: f.geometry,
    })),
  }

  const topo = topology({ regions: collection })

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.senedd.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(topo))
  console.log(`Wrote ${outPath} (${geojson.features.length} constituencies)`)
  console.log('Run mapshaper directly afterwards to simplify for web payload size, e.g.:')
  console.log('  npx mapshaper src/data/scenarios/uk-2025-01-01/boundaries.senedd.json -simplify 10% keep-shapes -o format=topojson force src/data/scenarios/uk-2025-01-01/boundaries.senedd.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
