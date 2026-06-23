// Builds the Senedd (Welsh Parliament) seat composition as of the scenario's
// as-of date (2025-01-01), modelling the old/current 60-member system: 40
// constituency FPTP seats + 20 regional list seats across 5 electoral
// regions (Mid and West Wales, North Wales, South Wales Central, South
// Wales East, South Wales West) — NOT the 96-member 2026 reform.
//
// Source data (member/constituency/region/party as of 2025-01-01) was
// compiled via Wikipedia's 6th Senedd membership tables, cross-checked
// against contemporaneous news reporting for members whose party changed
// after 2025-01-01 (so the *as-of-date* party, not today's, is used — see
// AS_OF_DATE_OVERRIDES below). There is no per-member API to query
// programmatically (unlike Commons' members-api.parliament.uk), so this
// script embeds the verified roster directly rather than fetching pages at
// runtime.
//
// Regional list seats have no drawable boundary (the boundaries file only
// covers the 40 constituencies), so each electoral region gets a synthetic
// id/geometryRef of the form "region:<kebab-case-name>" with seats=[5 MSs],
// regionId on each Seat set to the same synthetic id.
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolvePartySlug } from './party-slugs.mjs'
import { normaliseConstituencyName } from './constituency-name.mjs'

const AS_OF_DATE = '2025-01-01'

// --- Constituency members (40), party as of 2025-01-01 -------------------
// Source: Wikipedia "Members of the 6th Senedd" constituency table.
// Overrides applied (post-as-of-date party changes, verified via news
// search, NOT reflected here):
//   - James Evans (Brecon and Radnorshire): Conservative on 2025-01-01;
//     sacked/lost the whip Jan 2026, joined Reform UK 5 Feb 2026.
//   - Russell George (Montgomeryshire): Conservative on 2025-01-01;
//     suspended from the Conservative group in April 2025 (gambling-related
//     charges), sitting as Independent since.
const CONSTITUENCY_MEMBERS = [
  ['Aberavon', 'David Rees', 'Labour'],
  ['Aberconwy', 'Janet Finch-Saunders', 'Conservative'],
  ['Alyn and Deeside', 'Jack Sargeant', 'Labour'],
  ['Arfon', 'Siân Gwenllian', 'Plaid Cymru'],
  ['Blaenau Gwent', 'Alun Davies', 'Labour'],
  ['Brecon and Radnorshire', 'James Evans', 'Conservative'],
  ['Bridgend', 'Sarah Murphy', 'Labour'],
  ['Caerphilly', 'Lindsay Whittle', 'Plaid Cymru'],
  ['Cardiff Central', 'Jenny Rathbone', 'Labour'],
  ['Cardiff North', 'Julie Morgan', 'Labour'],
  ['Cardiff South and Penarth', 'Vaughan Gething', 'Labour'],
  ['Cardiff West', 'Mark Drakeford', 'Labour'],
  ['Carmarthen East and Dinefwr', 'Adam Price', 'Plaid Cymru'],
  ['Carmarthen West and South Pembrokeshire', 'Samuel Kurtz', 'Conservative'],
  ['Ceredigion', 'Elin Jones', 'Plaid Cymru'],
  ['Clwyd South', 'Ken Skates', 'Labour'],
  ['Clwyd West', 'Darren Millar', 'Conservative'],
  ['Cynon Valley', 'Vikki Howells', 'Labour'],
  ['Delyn', 'Hannah Blythyn', 'Labour'],
  ['Dwyfor Meirionnydd', 'Mabon ap Gwynfor', 'Plaid Cymru'],
  ['Gower', 'Rebecca Evans', 'Labour'],
  ['Islwyn', 'Rhianon Passmore', 'Labour'],
  ['Llanelli', 'Lee Waters', 'Labour'],
  ['Merthyr Tydfil and Rhymney', 'Dawn Bowden', 'Labour'],
  ['Monmouth', 'Peter Fox', 'Conservative'],
  ['Montgomeryshire', 'Russell George', 'Conservative'],
  ['Neath', 'Jeremy Miles', 'Labour'],
  ['Newport East', 'John Griffiths', 'Labour'],
  ['Newport West', 'Jayne Bryant', 'Labour'],
  ['Ogmore', 'Huw Irranca-Davies', 'Labour'],
  ['Pontypridd', 'Mick Antoniw', 'Labour'],
  ['Preseli Pembrokeshire', 'Paul Davies', 'Conservative'],
  ['Rhondda', 'Buffy Williams', 'Labour'],
  ['Swansea East', 'Mike Hedges', 'Labour'],
  ['Swansea West', 'Julie James', 'Labour'],
  ['Torfaen', 'Lynne Neagle', 'Labour'],
  ['Vale of Clwyd', 'Gareth Davies', 'Conservative'],
  ['Vale of Glamorgan', 'Jane Hutt', 'Labour'],
  ['Wrexham', 'Lesley Griffiths', 'Labour'],
  ['Ynys Môn', 'Rhun ap Iorwerth', 'Plaid Cymru'],
]

// --- Regional list members (20), party as of 2025-01-01 ------------------
// Source: Wikipedia "Members of the 6th Senedd" regional table.
// Override applied: Laura Anne Jones (South Wales East) was Conservative on
// 2025-01-01; defected to Reform UK on 22 July 2025 (the party's first
// Senedd member).
const REGIONAL_MEMBERS = [
  ['Mid and West Wales', 'Eluned Morgan', 'Labour'],
  ['Mid and West Wales', 'Cefin Campbell', 'Plaid Cymru'],
  ['Mid and West Wales', 'Jane Dodds', 'Liberal Democrat'],
  ['Mid and West Wales', 'Joyce Watson', 'Labour'],
  ['North Wales', 'Llŷr Gruffydd', 'Plaid Cymru'],
  ['North Wales', 'Mark Isherwood', 'Conservative'],
  ['North Wales', 'Sam Rowlands', 'Conservative'],
  ['North Wales', 'Carolyn Thomas', 'Labour'],
  ['South Wales Central', 'Andrew R. T. Davies', 'Conservative'],
  ['South Wales Central', 'Heledd Fychan', 'Plaid Cymru'],
  ['South Wales Central', 'Joel James', 'Conservative'],
  ['South Wales Central', 'Rhys ab Owen', 'Independent'],
  ['South Wales East', 'Natasha Asghar', 'Conservative'],
  ['South Wales East', 'Peredur Owen Griffiths', 'Plaid Cymru'],
  ['South Wales East', 'Delyth Jewell', 'Plaid Cymru'],
  ['South Wales East', 'Laura Anne Jones', 'Conservative'],
  ['South Wales West', 'Luke Fletcher', 'Plaid Cymru'],
  ['South Wales West', 'Tom Giffard', 'Conservative'],
  ['South Wales West', 'Altaf Hussain', 'Conservative'],
  ['South Wales West', 'Sioned Williams', 'Plaid Cymru'],
]

function regionSlug(name) {
  return `region:${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`
}

function main() {
  const boundariesPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.senedd.json', import.meta.url),
  )
  const boundaries = JSON.parse(readFileSync(boundariesPath, 'utf-8'))
  const nameToGeometryRef = new Map(
    boundaries.objects.regions.geometries.map((g) => [
      normaliseConstituencyName(g.properties.name),
      g.properties.geometryRef,
    ]),
  )

  const regions = []

  // Constituency regions (one Region per constituency, one Seat each).
  for (const [constituencyName, memberName, partyName] of CONSTITUENCY_MEMBERS) {
    const geometryRef = nameToGeometryRef.get(normaliseConstituencyName(constituencyName))
    if (!geometryRef) {
      console.warn(`[fetch-senedd-composition] No boundary match for constituency "${constituencyName}"`)
    }
    const party = resolvePartySlug(partyName, { warnPrefix: '[fetch-senedd-composition]' })
    const id = geometryRef ?? constituencyName
    regions.push({
      id,
      tier: 'senedd',
      name: constituencyName,
      geometryRef: id,
      seats: [
        {
          regionId: id,
          party,
          memberName,
          electedAt: '2021-05-06', // 2021 Senedd election (all seats elected together)
        },
      ],
    })
  }

  if (regions.length !== 40) {
    throw new Error(`Expected 40 constituency regions, got ${regions.length}`)
  }

  // Regional list regions (one Region per electoral region, multiple seats).
  const byRegion = new Map()
  for (const [regionName, memberName, partyName] of REGIONAL_MEMBERS) {
    if (!byRegion.has(regionName)) byRegion.set(regionName, [])
    byRegion.get(regionName).push({ memberName, partyName })
  }

  if (byRegion.size !== 5) {
    throw new Error(`Expected 5 electoral regions, got ${byRegion.size}`)
  }

  for (const [regionName, members] of byRegion) {
    const id = regionSlug(regionName)
    regions.push({
      id,
      tier: 'senedd',
      name: regionName,
      geometryRef: id,
      seats: members.map(({ memberName, partyName }) => ({
        regionId: id,
        party: resolvePartySlug(partyName, { warnPrefix: '[fetch-senedd-composition]' }),
        memberName,
        electedAt: '2021-05-06',
      })),
    })
  }

  regions.sort((a, b) => a.id.localeCompare(b.id))

  const totalSeats = regions.reduce((sum, r) => sum + r.seats.length, 0)
  console.log(`Built ${regions.length} regions, ${totalSeats} total seats (as of ${AS_OF_DATE}).`)
  if (totalSeats !== 60) {
    throw new Error(`Expected 60 total seats, got ${totalSeats}`)
  }
  if (regions.length !== 45) {
    throw new Error(`Expected 45 total regions (40 constituency + 5 list), got ${regions.length}`)
  }

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.senedd.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(regions, null, 2))
  console.log(`Wrote ${outPath}`)
}

main()
