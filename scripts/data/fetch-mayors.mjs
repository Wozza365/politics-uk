// Builds the as-of-2025-01-01 Mayoralty[] (src/types/mayoralty.ts) covering
// spec §4.1 rows 7-8: the London mayoralty, the combined-authority "metro"
// mayors, and single-council directly-elected local mayors. Written to
// src/data/scenarios/uk-2025-01-01/mayoralties.json, read by
// build-scenario.mjs.
//
// Not a live API fetch -- there is no single bulk source for this, so each
// entry is hand-curated from Wikipedia/news coverage of the relevant
// election or by-election, cross-checked against the actual holder as of
// 2025-01-01 specifically (several mayoralties changed hands close to that
// date, so "currently in office" sources had to be checked for drift):
//   - Cambridgeshire and Peterborough: still Nik Johnson (Labour, elected
//     2021-05-06) as of 2025-01-01 -- Paul Bristow (Conservative) only won
//     the seat on 2025-05-01, after this scenario's date.
//   - West of England: still Dan Norris (Labour, elected 2021-05-06) as of
//     2025-01-01 -- not up for election until 2025-05-01 (won by Helen
//     Godwin, also after this scenario's date).
//   - Hackney: Caroline Woodley (Labour) won a by-election on 2023-11-09
//     after Philip Glanville's resignation, so she -- not Glanville -- is
//     the 2025-01-01 holder.
//   - Lewisham: Brenda Dacres (Labour) won a by-election on 2024-03-07 after
//     Damien Egan resigned to fight (and win) a parliamentary by-election.
//
// Six combined authorities (Greater Manchester, Liverpool City Region, West
// Midlands, West Yorkshire, South Yorkshire, Tees Valley) plus three brand
// new ones (North East, East Midlands, York and North Yorkshire) all elected
// mayors on 2024-05-02; Greater Lincolnshire and Hull and East Yorkshire
// followed in May 2025 and are out of scope for this 2025-01-01 scenario.
//
// "Other directly-elected local" mayors omit councils that had abolished the
// role before 2025-01-01 (Bristol, Liverpool, Torbay, Copeland, Hartlepool,
// Stoke-on-Trent) -- only the 13 councils that still ran a directly-elected
// mayor as of that date are included.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolvePartySlug } from './party-slugs.mjs'

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// [office name, area slug seed, kind, member name, party name, electedAt]
const MAYORALTIES = [
  ['Mayor of London', 'Greater London', 'london', 'Sadiq Khan', 'Labour', '2024-05-02'],

  ['Mayor of Greater Manchester', 'Greater Manchester', 'combined_authority', 'Andy Burnham', 'Labour', '2024-05-02'],
  ['Mayor of the Liverpool City Region', 'Liverpool City Region', 'combined_authority', 'Steve Rotheram', 'Labour', '2024-05-02'],
  ['Mayor of the West Midlands', 'West Midlands', 'combined_authority', 'Richard Parker', 'Labour', '2024-05-02'],
  ['Mayor of West Yorkshire', 'West Yorkshire', 'combined_authority', 'Tracy Brabin', 'Labour', '2024-05-02'],
  ['Mayor of South Yorkshire', 'South Yorkshire', 'combined_authority', 'Oliver Coppard', 'Labour', '2024-05-02'],
  ['Mayor of Tees Valley', 'Tees Valley', 'combined_authority', 'Ben Houchen', 'Conservative', '2024-05-02'],
  ['Mayor of the West of England', 'West of England', 'combined_authority', 'Dan Norris', 'Labour', '2021-05-06'],
  ['Mayor of Cambridgeshire and Peterborough', 'Cambridgeshire and Peterborough', 'combined_authority', 'Nik Johnson', 'Labour', '2021-05-06'],
  ['Mayor of the North East', 'North East', 'combined_authority', 'Kim McGuinness', 'Labour', '2024-05-02'],
  ['Mayor of the East Midlands', 'East Midlands', 'combined_authority', 'Claire Ward', 'Labour', '2024-05-02'],
  ['Mayor of York and North Yorkshire', 'York and North Yorkshire', 'combined_authority', 'David Skaith', 'Labour', '2024-05-02'],

  ['Mayor of Bedford Borough', 'Bedford', 'local', 'Tom Wootton', 'Conservative', '2023-05-04'],
  ['Mayor of Leicester', 'Leicester', 'local', 'Peter Soulsby', 'Labour', '2023-05-04'],
  ['Mayor of Croydon', 'Croydon', 'local', 'Jason Perry', 'Conservative', '2022-05-05'],
  ['Mayor of Hackney', 'Hackney', 'local', 'Caroline Woodley', 'Labour', '2023-11-09'],
  ['Mayor of Lewisham', 'Lewisham', 'local', 'Brenda Dacres', 'Labour', '2024-03-07'],
  ['Mayor of Newham', 'Newham', 'local', 'Rokhsana Fiaz', 'Labour', '2022-05-05'],
  ['Mayor of Tower Hamlets', 'Tower Hamlets', 'local', 'Lutfur Rahman', 'Aspire', '2022-05-05'],
  ['Mayor of Doncaster', 'Doncaster', 'local', 'Ros Jones', 'Labour', '2021-05-06'],
  ['Mayor of Mansfield', 'Mansfield', 'local', 'Andy Abrahams', 'Labour', '2023-05-04'],
  ['Mayor of Middlesbrough', 'Middlesbrough', 'local', 'Chris Cooke', 'Labour', '2023-05-04'],
  ['Mayor of North Tyneside', 'North Tyneside', 'local', 'Karen Clark', 'Labour', '2024-05-02'],
  ['Mayor of Salford', 'Salford', 'local', 'Paul Dennett', 'Labour', '2021-05-06'],
  ['Mayor of Watford', 'Watford', 'local', 'Peter Taylor', 'Liberal Democrat', '2022-05-05'],
]

function main() {
  const mayoralties = MAYORALTIES.map(([name, areaName, kind, memberName, partyName, electedAt]) => ({
    id: `mayor:${slug(areaName)}`,
    name,
    kind,
    regionRef: slug(areaName),
    party: resolvePartySlug(partyName),
    memberName,
    electedAt,
  }))

  mayoralties.sort((a, b) => a.id.localeCompare(b.id))

  console.log(`Built ${mayoralties.length} mayoralties.`)

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/mayoralties.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(mayoralties, null, 2))
  console.log(`Wrote ${outPath}`)
}

main()
