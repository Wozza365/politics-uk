// Fetches current Westminster constituency boundaries (post-2023 boundary
// review) from the ONS Open Geography Portal and writes them as TopoJSON to
// src/data/scenarios/uk-2025-01-01/boundaries.commons.json, keyed by GSS code
// (matching Region.geometryRef, spec §4.2).
//
// Not runnable from this sandbox: geoportal.statistics.gov.uk is outside the
// network egress allowlist here (see ../../src/data/scenarios/uk-2025-01-01/README.md).
// Run this from an environment with access to the ONS ArcGIS REST API.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'

// TODO: confirm the exact ONS Open Geography Portal feature-service URL for
// "Westminster Parliamentary Constituencies (July 2024) Boundaries UK BFC" —
// unverified, since the portal isn't reachable from this sandbox. Look it up
// at https://geoportal.statistics.gov.uk and replace before running.
const ONS_FEATURE_SERVICE =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
  'Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BFC/FeatureServer/0/query'

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
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
