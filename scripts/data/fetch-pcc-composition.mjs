// Builds Police & Crime Commissioner composition for P2.4 as a stats-only
// tier. PCCs are not council authorities and do not belong in the councils
// map granularity switcher.
//
// Source: House of Commons Library CBP-10030 and the matching election
// summary report 37 PCC areas in England and Wales elected on 2024-05-02.
// The headline result was Conservative 19, Labour 22 including five metro
// mayors with PCC powers, and Plaid Cymru 1. Those five mayoralties are
// already represented by P2.3, so this tier stores 37 PCC-only seats:
// Conservative 19, Labour 17, Plaid Cymru 1.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const GROUPS = {
  conservative: 19,
  labour: 17,
  plaid_cymru: 1,
}

function main() {
  const regions = Object.entries(GROUPS).flatMap(([party, count]) =>
    Array.from({ length: count }, (_, index) => ({
      id: `pcc-${party}-${index + 1}`,
      tier: 'pcc',
      name: `Police and Crime Commissioner (${party.replace(/_/g, ' ')}) ${index + 1}`,
      geometryRef: `pcc-${party}-${index + 1}`,
      seats: [
        {
          regionId: `pcc-${party}-${index + 1}`,
          party,
          electedAt: '2024-05-02',
        },
      ],
    })),
  )

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.pcc.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(regions, null, 2))
  console.log(`Built ${regions.length} PCC seats.`)
  console.log(`Wrote ${outPath}`)
}

main()
