// Builds the NI Assembly composition (90 MLAs, 5 per constituency × 18
// constituencies, elected by STV) as of the scenario's as-of date
// (2025-01-01), matched against the boundaries already derived in
// src/data/scenarios/uk-2025-01-01/boundaries.ni_assembly.json
// (derive-ni-assembly-boundaries.mjs), and written as Region[] (tier
// "ni_assembly") to
// src/data/scenarios/uk-2025-01-01/composition.ni_assembly.json.
//
// Source: the 18 constituency results of the 5 May 2022 NI Assembly
// election (Wikipedia "2022 Northern Ireland Assembly election" and each
// constituency's Wikipedia page), cross-checked member-by-member via
// Wikipedia biography pages for resignations/co-options up to 2025-01-01
// (the NI Assembly's own MLA listing pages returned 404 at fetch time).
// STV elects 5 equal members per constituency with no single winner, so
// Seat.majority/voteShare are omitted (both optional on Seat — see
// src/types/region.ts) — only party, memberName and electedAt are set,
// with electedAt reflecting either the 2022 election date or the later
// co-option date where a member changed.
//
// Co-options/changes resolved as holding the seat on 2025-01-01 (in place
// of the originally-elected 2022 member):
//   - Lagan Valley: Emma Little-Pengelly (DUP) co-opted 12 May 2022 for
//     Jeffrey Donaldson (DUP), who declined to take his seat.
//   - North Antrim: Sian Mulholland (Alliance) co-opted ~31 Mar 2023 for
//     Patricia O'Lynn (Alliance), who resigned.
//   - East Antrim: Cheryl Brownlee (DUP) co-opted Sept 2023 for David
//     Hilditch (DUP), who resigned due to ill health.
//   - South Down: Andrew McMurray (Alliance) co-opted April 2024 for
//     Patrick Brown (Alliance) — NB Patrick Brown was originally elected
//     for the UUP in 2022; by the time of his resignation/replacement the
//     seat is treated here per the co-option party (Alliance) as that is
//     the seat's holder of record going into 2025.
// Edwin Poots (Belfast South) has been Speaker of the Assembly since
// February 2024; by the same convention used for the Commons composition
// fetch (Lindsay Hoyle), his seat's party is recorded as the dedicated
// "speaker" slug rather than his originally-elected party (DUP).
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolvePartySlug } from './party-slugs.mjs'

const AS_OF_DATE = '2025-01-01'

// One entry per constituency, 5 MLA names + party names (post-2022,
// post-co-option, as holding the seat on 2025-01-01) and the election/
// co-option date for each, in the same order as the boundaries file's
// constituency names.
const CONSTITUENCIES = [
  {
    name: 'Belfast East',
    members: [
      { name: 'Naomi Long', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'Joanne Bunting', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Peter McReynolds', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'David Brooks', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Andy Allen', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Belfast North',
    members: [
      { name: 'Gerry Kelly', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Carál Ní Chuilín', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Phillip Brett', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Brian Kingston', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Nuala McAllister', party: 'Alliance', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Belfast South and Mid Down',
    members: [
      { name: 'Deirdre Hargey', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Edwin Poots', party: 'Speaker', electedAt: '2022-05-05' },
      { name: "Matthew O'Toole", party: 'Social Democratic & Labour Party', electedAt: '2022-05-05' },
      { name: 'Paula Bradshaw', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'Kate Nicholl', party: 'Alliance', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Belfast West',
    members: [
      { name: 'Danny Baker', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Órlaithí Flynn', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Aisling Reilly', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Pat Sheehan', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Gerry Carroll', party: 'People Before Profit', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'East Antrim',
    members: [
      { name: 'Gordon Lyons', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Cheryl Brownlee', party: 'Democratic Unionist Party', electedAt: '2023-09-08' },
      { name: 'John Stewart', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
      { name: 'Stewart Dickson', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'Danny Donnelly', party: 'Alliance', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'East Londonderry',
    members: [
      { name: 'Maurice Bradley', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Alan Robinson', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Caoimhe Archibald', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Cara Hunter', party: 'Social Democratic & Labour Party', electedAt: '2022-05-05' },
      { name: 'Claire Sugden', party: 'Independent', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Fermanagh and South Tyrone',
    members: [
      { name: 'Deborah Erskine', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Jemma Dolan', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Colm Gildernew', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Áine Murphy', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Tom Elliott', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Foyle',
    members: [
      { name: 'Gary Middleton', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Pádraig Delargy', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Ciara Ferguson', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Mark H. Durkan', party: 'Social Democratic & Labour Party', electedAt: '2022-05-05' },
      { name: 'Sinéad McLaughlin', party: 'Social Democratic & Labour Party', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Lagan Valley',
    members: [
      { name: 'Emma Little-Pengelly', party: 'Democratic Unionist Party', electedAt: '2022-05-12' },
      { name: 'Paul Givan', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Robbie Butler', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
      { name: 'Sorcha Eastwood', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'David Honeyford', party: 'Alliance', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Mid Ulster',
    members: [
      { name: 'Michelle O’Neill', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Linda Dillon', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Emma Sheerin', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Keith Buchanan', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Patsy McGlone', party: 'Social Democratic & Labour Party', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Newry and Armagh',
    members: [
      { name: 'Cathal Boylan', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Liz Kimmins', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Conor Murphy', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'William Irwin', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Justin McNulty', party: 'Social Democratic & Labour Party', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'North Antrim',
    members: [
      { name: 'Paul Frew', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Philip McGuigan', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Robin Swann', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
      { name: 'Jim Allister', party: 'Traditional Unionist Voice', electedAt: '2022-05-05' },
      { name: 'Sian Mulholland', party: 'Alliance', electedAt: '2023-03-31' },
    ],
  },
  {
    name: 'North Down',
    members: [
      { name: 'Stephen Dunne', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Alan Chambers', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
      { name: 'Connie Egan', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'Andrew Muir', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'Alex Easton', party: 'Independent', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'South Antrim',
    members: [
      { name: 'Pam Cameron', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Trevor Clarke', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Declan Kearney', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Steve Aiken', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
      { name: 'John Blair', party: 'Alliance', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'South Down',
    members: [
      { name: 'Sinéad Ennis', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Cathy Mason', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Diane Forsythe', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Colin McGrath', party: 'Social Democratic & Labour Party', electedAt: '2022-05-05' },
      { name: 'Andrew McMurray', party: 'Alliance', electedAt: '2024-04-01' },
    ],
  },
  {
    name: 'Strangford',
    members: [
      { name: 'Kellie Armstrong', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'Nick Mathison', party: 'Alliance', electedAt: '2022-05-05' },
      { name: 'Harry Harvey', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Michelle McIlveen', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Mike Nesbitt', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'Upper Bann',
    members: [
      { name: 'Jonathan Buckley', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Diane Dodds', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: "John O'Dowd", party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Doug Beattie', party: 'Ulster Unionist Party', electedAt: '2022-05-05' },
      { name: 'Eóin Tennyson', party: 'Alliance', electedAt: '2022-05-05' },
    ],
  },
  {
    name: 'West Tyrone',
    members: [
      { name: 'Nicola Brogan', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Declan McAleer', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Maolíosa McHugh', party: 'Sinn Féin', electedAt: '2022-05-05' },
      { name: 'Tom Buchanan', party: 'Democratic Unionist Party', electedAt: '2022-05-05' },
      { name: 'Daniel McCrossan', party: 'Social Democratic & Labour Party', electedAt: '2022-05-05' },
    ],
  },
]

function main() {
  const boundariesPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.ni_assembly.json', import.meta.url),
  )
  const boundaries = JSON.parse(readFileSync(boundariesPath, 'utf-8'))
  const nameToGeometryRef = new Map(
    boundaries.objects.regions.geometries.map((g) => [g.properties.name, g.properties.geometryRef]),
  )

  const regions = CONSTITUENCIES.map(({ name, members }) => {
    const geometryRef = nameToGeometryRef.get(name)
    if (!geometryRef) {
      console.warn(`[fetch-ni-assembly-composition] No boundary match for constituency "${name}"`)
    }
    const id = geometryRef ?? name
    return {
      id,
      tier: 'ni_assembly',
      name,
      geometryRef: id,
      seats: members.map((m) => ({
        regionId: id,
        party: m.party === 'Speaker' ? 'speaker' : resolvePartySlug(m.party),
        memberName: m.name,
        electedAt: m.electedAt,
      })),
    }
  })

  regions.sort((a, b) => a.id.localeCompare(b.id))

  const totalSeats = regions.reduce((sum, r) => sum + r.seats.length, 0)
  console.log(`Built ${regions.length} regions, ${totalSeats} total seats (as of ${AS_OF_DATE}).`)

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.ni_assembly.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(regions, null, 2))
  console.log(`Wrote ${outPath}`)
}

main()
