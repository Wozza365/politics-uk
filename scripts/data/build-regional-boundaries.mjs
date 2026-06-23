// Merges the four Regional-view tiers' boundary topologies (Holyrood,
// Senedd, NI Assembly, London Assembly) plus England-outside-London filler
// geometry from boundaries.commons.json into one combined
// boundaries.regional.json (P2.1 step 4).
//
// Each source topology was quantized independently (own transform/precision),
// so raw arcs can't just be concatenated — this decodes every source
// topology back to GeoJSON features via topojson-client, combines them into
// one FeatureCollection, and re-runs topojson-server's topology() once to
// produce a single consistent quantization.
//
// Filler regions keep their original commons geometryRef (the constituency's
// GSS code) and get no special marker here — MapView.vue determines "is this
// filler?" at render time by checking whether the geometryRef belongs to a
// real Regional-tier region, since disabled/greyed-out is a RegionState
// rendering concern (src/map/MapRenderer.ts's RegionDisplayState.disabled),
// not a data-model one.
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import { topology } from 'topojson-server'

function readJson(relativePath) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function featuresFromTopology(topo) {
  const collection = feature(topo, topo.objects.regions)
  return collection.features
}

function main() {
  const regionalFeatures = [
    ...featuresFromTopology(readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.holyrood.json')),
    ...featuresFromTopology(readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.senedd.json')),
    ...featuresFromTopology(readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.ni_assembly.json')),
    ...featuresFromTopology(readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.london_assembly.json')),
  ]

  const londonConstituencyIds = new Set(
    readJson('../../src/data/scenarios/uk-2025-01-01/london-constituencies.json'),
  )
  const commonsFeatures = featuresFromTopology(
    readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.commons.json'),
  )
  const fillerFeatures = commonsFeatures.filter(
    (f) => f.properties.geometryRef.startsWith('E') && !londonConstituencyIds.has(f.properties.geometryRef),
  )

  const collection = {
    type: 'FeatureCollection',
    features: [...regionalFeatures, ...fillerFeatures],
  }

  const topo = topology({ regions: collection })

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.regional.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(topo))
  console.log(
    `Wrote ${outPath} (${regionalFeatures.length} regional + ${fillerFeatures.length} filler = ` +
      `${collection.features.length} total geometries)`,
  )
}

main()
