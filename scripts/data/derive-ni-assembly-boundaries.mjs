// Derives src/data/scenarios/uk-2025-01-01/boundaries.ni_assembly.json from
// the existing Commons boundaries topology.
//
// The Northern Ireland Assembly elects its 90 MLAs (5 per constituency, via
// STV) from the *same* 18 constituencies as Westminster in NI — so no new
// boundary geometry needs to be fetched. We just filter
// boundaries.commons.json's objects.regions.geometries down to the 18 NI
// features (PCON24 codes starting "N05" — note: NOT "N06"; N05 is the actual
// GSS prefix used by this dataset's PCON24 codes for Northern Ireland, see
// boundaries.commons.json itself) and rebuild a fresh, minimal TopoJSON
// topology from just those features (rather than slicing objects.regions
// geometries in place and keeping the full 650-feature arcs array, which
// would leave ~4900 unrelated arcs as dead weight and risks stale arc
// indices if anything downstream re-quantizes).
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import { topology } from 'topojson-server'

const NI_GSS_PREFIX = 'N05'

function main() {
  const boundariesPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.commons.json', import.meta.url),
  )
  const commonsTopology = JSON.parse(readFileSync(boundariesPath, 'utf-8'))

  // Decode the full Commons topology to GeoJSON, then keep only the 18 NI
  // features.
  const commonsCollection = feature(commonsTopology, commonsTopology.objects.regions)
  const niFeatures = commonsCollection.features.filter((f) =>
    f.properties.geometryRef.startsWith(NI_GSS_PREFIX),
  )

  if (niFeatures.length !== 18) {
    throw new Error(`Expected exactly 18 NI constituencies (prefix ${NI_GSS_PREFIX}), found ${niFeatures.length}`)
  }

  // Rebuild a fresh, minimal topology containing just these 18 features
  // under the same "regions" object key/shape as boundaries.commons.json.
  const niTopology = topology({ regions: { type: 'FeatureCollection', features: niFeatures } })

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.ni_assembly.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(niTopology))
  console.log(`Wrote ${outPath} (${niTopology.objects.regions.geometries.length} features)`)
}

main()
