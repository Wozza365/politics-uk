// Derives which of the 650 Westminster constituencies (boundaries.commons.json)
// sit inside Greater London, so build-regional-boundaries.mjs (P2.1) can
// exclude them from the "England outside London" grey filler geometry —
// London's area is instead covered by the real, interactive London Assembly
// boundaries.
//
// There's no direct ONS "constituency to region" lookup table for the 2024
// boundary review at the time of writing, so this derives the answer
// geometrically: fetch the official London region polygon from the ONS Open
// Geography Portal ("Regions (December 2024) Boundaries EN BUC", ArcGIS item
// d471e7de92fc43aba1050dcec35d1fb3) and point-in-polygon test each England
// constituency's ONS-supplied centroid (LAT/LONG fields already on the same
// feature service fetch-commons-boundaries.mjs uses) against it.
//
// Result: 75 constituencies — matches the well-known figure for Greater
// London's seat count after the 2023 boundary review.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { geoContains } from 'd3-geo'

const REGIONS_FEATURE_SERVICE =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
  'Regions_December_2024_Boundaries_EN_BUC/FeatureServer/0/query'

const CONSTITUENCIES_FEATURE_SERVICE =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
  'Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC/FeatureServer/0/query'

async function fetchJson(url, params) {
  const res = await fetch(`${url}?${params}`)
  if (!res.ok) throw new Error(`request failed: ${res.status} ${res.statusText}`)
  return res.json()
}

async function main() {
  const regionGeojson = await fetchJson(
    REGIONS_FEATURE_SERVICE,
    new URLSearchParams({ where: "RGN24NM='London'", outFields: 'RGN24CD,RGN24NM', outSR: '4326', f: 'geojson' }),
  )
  const london = regionGeojson.features[0]

  const constituencies = await fetchJson(
    CONSTITUENCIES_FEATURE_SERVICE,
    new URLSearchParams({ where: '1=1', outFields: 'PCON24CD,LAT,LONG', returnGeometry: 'false', f: 'json' }),
  )

  const londonConstituencyIds = constituencies.features
    .map((f) => f.attributes)
    .filter((a) => a.PCON24CD.startsWith('E') && geoContains(london.geometry, [a.LONG, a.LAT]))
    .map((a) => a.PCON24CD)
    .sort()

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/london-constituencies.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(londonConstituencyIds, null, 2) + '\n')
  console.log(`Wrote ${outPath} (${londonConstituencyIds.length} constituencies)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
