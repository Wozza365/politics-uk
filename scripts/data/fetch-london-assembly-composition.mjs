// Writes the London Assembly seat holders as of the scenario's as-of date
// (2025-01-01) as Region[] (london_assembly tier) to
// src/data/scenarios/uk-2025-01-01/composition.london_assembly.json,
// matching the shape of src/types/region.ts.
//
// 14 single-member constituencies (Additional Member System "first" seats)
// each become one Region with one Seat, geometryRef = the GSS code from
// boundaries.london_assembly.json (matches fetch-commons-composition.mjs's
// pattern). The 11 London-wide list seats have no drawable geometry — there
// is no sub-London boundary for them — so they are modelled as a single
// synthetic Region (id/geometryRef "london-wide") holding all 11 Seats, with
// regionId left as that same synthetic id on every seat.
//
// Source: the 6 May 2024 London Assembly election results (the most recent
// election before the 2025-01-01 as-of date — NOT the 2021 election, which
// was superseded), cross-checked against later changes up to 2025-01-01 via
// Wikipedia's "2024 London Assembly election" page and London City Hall's
// official members pages:
//   - Siân Berry (Green, list) resigned 3 days after the May 2024 election
//     and was replaced by Zoë Garbett, sworn in 7 May 2024 — so the Green
//     list seat is held by Garbett, not Berry, as of 2025-01-01.
//   - Keith Prince (Havering & Redbridge) defected from Conservative to
//     Reform UK on 4 October 2025 — after the as-of date, so he is recorded
//     here as Conservative, his party as elected and as of 2025-01-01.
//   - No other resignations/replacements affected the chamber before
//     2025-01-01.
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolvePartySlug } from './party-slugs.mjs'

const TIER = 'london_assembly'

// Constituency AMs, keyed by constituency name as it appears in
// boundaries.london_assembly.json's geometry properties.
const CONSTITUENCY_MEMBERS = [
  { name: 'Barnet and Camden', memberName: 'Anne Clarke', party: 'Labour' },
  { name: 'Bexley and Bromley', memberName: 'Thomas Turrell', party: 'Conservative' },
  { name: 'Brent and Harrow', memberName: 'Krupesh Hirani', party: 'Labour' },
  { name: 'City and East', memberName: 'Unmesh Desai', party: 'Labour' },
  { name: 'Croydon and Sutton', memberName: 'Neil Garratt', party: 'Conservative' },
  { name: 'Ealing and Hillingdon', memberName: 'Bassam Mahfouz', party: 'Labour' },
  { name: 'Enfield and Haringey', memberName: 'Joanne McCartney', party: 'Labour' },
  { name: 'Greenwich and Lewisham', memberName: 'Len Duvall', party: 'Labour' },
  { name: 'Havering and Redbridge', memberName: 'Keith Prince', party: 'Conservative' },
  { name: 'Lambeth and Southwark', memberName: 'Marina Ahmad', party: 'Labour' },
  { name: 'Merton and Wandsworth', memberName: 'Leonie Cooper', party: 'Labour' },
  { name: 'North East', memberName: 'Sem Moema', party: 'Labour' },
  { name: 'South West', memberName: 'Gareth Roberts', party: 'Liberal Democrat' },
  { name: 'West Central', memberName: 'James Small-Edwards', party: 'Labour' },
]

// London-wide list AMs, as of 2025-01-01 (Berry -> Garbett succession
// already applied; see header note).
const LIST_MEMBERS = [
  { memberName: 'Elly Baker', party: 'Labour' },
  { memberName: 'Susan Hall', party: 'Conservative' },
  { memberName: 'Shaun Bailey', party: 'Conservative' },
  { memberName: 'Emma Best', party: 'Conservative' },
  { memberName: 'Andrew Boff', party: 'Conservative' },
  { memberName: 'Alessandro Georgiou', party: 'Conservative' },
  { memberName: 'Zoë Garbett', party: 'Green Party' },
  { memberName: 'Caroline Russell', party: 'Green Party' },
  { memberName: 'Zack Polanski', party: 'Green Party' },
  { memberName: 'Hina Bokhari', party: 'Liberal Democrat' },
  { memberName: 'Alex Wilson', party: 'Reform UK' },
]

const ELECTED_AT = '2024-05-02' // 2024 London Assembly election polling day

function main() {
  const boundariesPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.london_assembly.json', import.meta.url),
  )
  const boundaries = JSON.parse(readFileSync(boundariesPath, 'utf-8'))
  const nameToGeometryRef = new Map(
    boundaries.objects.regions.geometries.map((g) => [g.properties.name, g.properties.geometryRef]),
  )

  const constituencyRegions = CONSTITUENCY_MEMBERS.map(({ name, memberName, party }) => {
    const geometryRef = nameToGeometryRef.get(name)
    if (!geometryRef) {
      console.warn(`[fetch-london-assembly-composition] No boundary match for constituency "${name}"`)
    }
    const id = geometryRef ?? name
    return {
      id,
      tier: TIER,
      name,
      geometryRef: id,
      seats: [
        {
          regionId: id,
          party: resolvePartySlug(party),
          memberName,
          electedAt: ELECTED_AT,
        },
      ],
    }
  })

  const listRegion = {
    id: 'london-wide',
    tier: TIER,
    name: 'London-wide',
    geometryRef: 'london-wide',
    seats: LIST_MEMBERS.map(({ memberName, party }) => ({
      regionId: 'london-wide',
      party: resolvePartySlug(party),
      memberName,
      electedAt: ELECTED_AT,
    })),
  }

  const regions = [...constituencyRegions, listRegion].sort((a, b) => a.id.localeCompare(b.id))

  const totalSeats = regions.reduce((sum, r) => sum + r.seats.length, 0)
  console.log(`Built ${regions.length} regions, ${totalSeats} total seats.`)

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.london_assembly.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(regions, null, 2))
  console.log(`Wrote ${outPath} (${regions.length} regions)`)
}

main()
