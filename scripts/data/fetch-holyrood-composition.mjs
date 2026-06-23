// Builds the Holyrood (Scottish Parliament) seat composition as of the
// scenario's as-of date (2025-01-01) as Region[] (holyrood tier) to
// src/data/scenarios/uk-2025-01-01/composition.holyrood.json, matching the
// shape of src/types/region.ts.
//
// Unlike fetch-commons-composition.mjs this is not a live API fetch: there is
// no Scottish-Parliament equivalent of the UK Parliament Members API with a
// bulk/searchable endpoint, and the Scottish Parliament's own MSP-by-date
// search is an interactive SPA with no stable bulk export reachable from
// this environment. Instead the 2021 election result (constituency winners +
// regional list members, cross-checked across Wikipedia's "Results of the
// 2021 Scottish Parliament election" page and individual constituency
// articles) is taken as the base, then adjusted for the only two
// state changes that happened before 2025-01-01 (verified against
// "List of by-elections to the Scottish Parliament" — there were zero
// by-elections in this session before 2025-01-01, so every constituency
// winner from 2021 is still the as-of-date holder; list seats are never
// re-allocated on defection/expulsion under Holyrood rules, so the holder
// is also unchanged, only their party differs from 2021):
//   - Ash Regan (Edinburgh Eastern, constituency): SNP -> Alba, 28 Oct 2023
//   - John Mason (Glasgow Shettleston, constituency): SNP -> Independent,
//     expelled 13 Oct 2024
// (Christina McKelvie, Hamilton Larkhall and Stonehouse, died 27 Mar 2025 --
// after the as-of date -- so she is still the SNP holder in this snapshot.)
//
// Constituency regions are matched against boundaries.holyrood.json by name
// (geometryRef = that file's GSS-style "S16..." code). List regions have no
// drawable geometry of their own (they span many constituency boundaries),
// so each of the 8 electoral regions gets a synthetic
// geometryRef/id = "region:<slug>" -- documented here rather than in
// boundaries.holyrood.json, which this script does not touch.
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolvePartySlug } from './party-slugs.mjs'

const AS_OF_DATE = '2025-01-01'

// Constituency seats: [constituencyName, memberName, partyName]
// Source: Wikipedia "Results of the 2021 Scottish Parliament election" +
// individual constituency articles (West Scotland cross-checked seat by
// seat as the omnibus results page's West Scotland table was truncated on
// fetch). Party reflects 2025-01-01, not 2021, for the two changed seats
// noted above.
const CONSTITUENCY_SEATS = {
  'Central Scotland': [
    ['Airdrie and Shotts', 'Neil Gray', 'Scottish National Party'],
    ['Coatbridge and Chryston', 'Fulton MacGregor', 'Scottish National Party'],
    ['Cumbernauld and Kilsyth', 'Jamie Hepburn', 'Scottish National Party'],
    ['East Kilbride', 'Collette Stevenson', 'Scottish National Party'],
    ['Falkirk East', 'Michelle Thomson', 'Scottish National Party'],
    ['Falkirk West', 'Michael Matheson', 'Scottish National Party'],
    ['Hamilton, Larkhall and Stonehouse', 'Christina McKelvie', 'Scottish National Party'],
    ['Motherwell and Wishaw', 'Clare Adamson', 'Scottish National Party'],
    ['Uddingston and Bellshill', 'Stephanie Callaghan', 'Scottish National Party'],
  ],
  Glasgow: [
    ['Glasgow Anniesland', 'Bill Kidd', 'Scottish National Party'],
    ['Glasgow Cathcart', 'James Dornan', 'Scottish National Party'],
    ['Glasgow Kelvin', 'Kaukab Stewart', 'Scottish National Party'],
    ['Glasgow Maryhill and Springburn', 'Bob Doris', 'Scottish National Party'],
    ['Glasgow Pollok', 'Humza Yousaf', 'Scottish National Party'],
    ['Glasgow Provan', 'Ivan McKee', 'Scottish National Party'],
    ['Glasgow Shettleston', 'John Mason', 'Independent'], // SNP at 2021; expelled 13 Oct 2024
    ['Glasgow Southside', 'Nicola Sturgeon', 'Scottish National Party'],
    ['Rutherglen', 'Clare Haughey', 'Scottish National Party'],
  ],
  'Highlands and Islands': [
    ['Argyll and Bute', 'Jenni Minto', 'Scottish National Party'],
    ['Caithness, Sutherland and Ross', 'Maree Todd', 'Scottish National Party'],
    ['Inverness and Nairn', 'Fergus Ewing', 'Scottish National Party'],
    ['Moray', 'Richard Lochhead', 'Scottish National Party'],
    ['Na h-Eileanan an Iar', 'Alasdair Allan', 'Scottish National Party'],
    ['Orkney Islands', 'Liam McArthur', 'Liberal Democrat'],
    ['Shetland Islands', 'Beatrice Wishart', 'Liberal Democrat'],
    ['Skye, Lochaber and Badenoch', 'Kate Forbes', 'Scottish National Party'],
  ],
  Lothian: [
    ['Almond Valley', 'Angela Constance', 'Scottish National Party'],
    ['Edinburgh Central', 'Angus Robertson', 'Scottish National Party'],
    ['Edinburgh Eastern', 'Ash Regan', 'Alba Party'], // SNP at 2021; defected to Alba 28 Oct 2023
    ['Edinburgh Northern and Leith', 'Ben Macpherson', 'Scottish National Party'],
    ['Edinburgh Pentlands', 'Gordon MacDonald', 'Scottish National Party'],
    ['Edinburgh Southern', 'Daniel Johnson', 'Labour'],
    ['Edinburgh Western', 'Alex Cole-Hamilton', 'Liberal Democrat'],
    ['Linlithgow', 'Fiona Hyslop', 'Scottish National Party'],
    ['Midlothian North and Musselburgh', 'Colin Beattie', 'Scottish National Party'],
  ],
  'Mid Scotland and Fife': [
    ['Clackmannanshire and Dunblane', 'Keith Brown', 'Scottish National Party'],
    ['Cowdenbeath', 'Annabelle Ewing', 'Scottish National Party'],
    ['Dunfermline', 'Shirley-Anne Somerville', 'Scottish National Party'],
    ['Kirkcaldy', 'David Torrance', 'Scottish National Party'],
    ['Mid Fife and Glenrothes', 'Jenny Gilruth', 'Scottish National Party'],
    ['North East Fife', 'Willie Rennie', 'Liberal Democrat'],
    ['Perthshire North', 'John Swinney', 'Scottish National Party'],
    ['Perthshire South and Kinross-shire', 'Jim Fairlie', 'Scottish National Party'],
    ['Stirling', 'Evelyn Tweed', 'Scottish National Party'],
  ],
  'North East Scotland': [
    ['Aberdeen Central', 'Kevin Stewart', 'Scottish National Party'],
    ['Aberdeen Donside', 'Jackie Dunbar', 'Scottish National Party'],
    ['Aberdeen South and North Kincardine', 'Audrey Nicoll', 'Scottish National Party'],
    ['Aberdeenshire East', 'Gillian Martin', 'Scottish National Party'],
    ['Aberdeenshire West', 'Alexander Burnett', 'Conservative'],
    ['Angus North and Mearns', 'Mairi Gougeon', 'Scottish National Party'],
    ['Angus South', 'Graeme Dey', 'Scottish National Party'],
    ['Banffshire and Buchan Coast', 'Karen Adam', 'Scottish National Party'],
    ['Dundee City East', 'Shona Robison', 'Scottish National Party'],
    ['Dundee City West', 'Joe FitzPatrick', 'Scottish National Party'],
  ],
  'South Scotland': [
    ['Ayr', 'Siobhian Brown', 'Scottish National Party'],
    ['Carrick, Cumnock and Doon Valley', 'Elena Whitham', 'Scottish National Party'],
    ['Clydesdale', 'Màiri McAllan', 'Scottish National Party'],
    ['Dumfriesshire', 'Oliver Mundell', 'Conservative'],
    ['East Lothian', 'Paul McLennan', 'Scottish National Party'],
    ['Ettrick, Roxburgh and Berwickshire', 'Rachael Hamilton', 'Conservative'],
    ['Galloway and West Dumfries', 'Finlay Carson', 'Conservative'],
    ['Kilmarnock and Irvine Valley', 'Willie Coffey', 'Scottish National Party'],
    ['Midlothian South, Tweeddale and Lauderdale', 'Christine Grahame', 'Scottish National Party'],
  ],
  'West Scotland': [
    ['Strathkelvin and Bearsden', 'Rona Mackay', 'Scottish National Party'],
    ['Clydebank and Milngavie', 'Marie McNair', 'Scottish National Party'],
    ['Dumbarton', 'Jackie Baillie', 'Labour'],
    ['Eastwood', 'Jackson Carlaw', 'Conservative'],
    ['Renfrewshire North and West', 'Natalie Don', 'Scottish National Party'],
    ['Renfrewshire South', 'Tom Arthur', 'Scottish National Party'],
    ['Greenock and Inverclyde', 'Stuart McMillan', 'Scottish National Party'],
    ['Paisley', 'George Adam', 'Scottish National Party'],
    ['Cunninghame North', 'Kenneth Gibson', 'Scottish National Party'],
    ['Cunninghame South', 'Ruth Maguire', 'Scottish National Party'],
  ],
}

// Regional list seats: [memberName, partyName], in the order each region's
// 7 list seats were allocated in 2021 (order is cosmetic here -- Region.id
// for list seats is derived from name, not rank).
const LIST_SEATS = {
  'Central Scotland': [
    ['Richard Leonard', 'Labour'],
    ['Monica Lennon', 'Labour'],
    ['Mark Griffin', 'Labour'],
    ['Stephen Kerr', 'Conservative'],
    ['Graham Simpson', 'Conservative'],
    ['Meghan Gallacher', 'Conservative'],
    ['Gillian Mackay', 'Scottish Greens'],
  ],
  Glasgow: [
    ['Pauline McNeill', 'Labour'],
    ['Anas Sarwar', 'Labour'],
    ['Paul Sweeney', 'Labour'],
    ['Pam Duncan-Glancy', 'Labour'],
    ['Annie Wells', 'Conservative'],
    ['Sandesh Gulhane', 'Conservative'],
    ['Patrick Harvie', 'Scottish Greens'],
  ],
  'Highlands and Islands': [
    ['Emma Roddick', 'Scottish National Party'],
    ['Douglas Ross', 'Conservative'],
    ['Donald Cameron', 'Conservative'],
    ['Edward Mountain', 'Conservative'],
    ['Jamie Halcro Johnston', 'Conservative'],
    ['Rhoda Grant', 'Labour'],
    ['Ariane Burgess', 'Scottish Greens'],
  ],
  Lothian: [
    ['Miles Briggs', 'Conservative'],
    ['Sue Webber', 'Conservative'],
    ['Jeremy Balfour', 'Conservative'],
    ['Sarah Boyack', 'Labour'],
    ['Foysol Choudhury', 'Labour'],
    ['Alison Johnstone', 'Scottish Greens'],
    ['Lorna Slater', 'Scottish Greens'],
  ],
  'Mid Scotland and Fife': [
    ['Murdo Fraser', 'Conservative'],
    ['Liz Smith', 'Conservative'],
    ['Dean Lockhart', 'Conservative'],
    ['Alexander Stewart', 'Conservative'],
    ['Claire Baker', 'Labour'],
    ['Alex Rowley', 'Labour'],
    ['Mark Ruskell', 'Scottish Greens'],
  ],
  'North East Scotland': [
    ['Liam Kerr', 'Conservative'],
    ['Douglas Lumsden', 'Conservative'],
    ['Maurice Golden', 'Conservative'],
    ['Tess White', 'Conservative'],
    ['Michael Marra', 'Labour'],
    ['Mercedes Villalba', 'Labour'],
    ['Maggie Chapman', 'Scottish Greens'],
  ],
  'South Scotland': [
    ['Colin Smyth', 'Labour'],
    ['Carol Mochan', 'Labour'],
    ['Martin Whitfield', 'Labour'],
    ['Craig Hoy', 'Conservative'],
    ['Brian Whittle', 'Conservative'],
    ['Sharon Dowey', 'Conservative'],
    ['Emma Harper', 'Scottish National Party'],
  ],
  'West Scotland': [
    ['Neil Bibby', 'Labour'],
    ['Katy Clark', 'Labour'],
    ['Paul O’Kane', 'Labour'],
    ['Russell Findlay', 'Conservative'],
    ['Jamie Greene', 'Conservative'],
    ['Pam Gosal', 'Conservative'],
    ['Ross Greer', 'Scottish Greens'],
  ],
}

function regionSlug(regionName) {
  return regionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function main() {
  const boundariesPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.holyrood.json', import.meta.url),
  )
  const boundaries = JSON.parse(readFileSync(boundariesPath, 'utf-8'))
  const nameToGeometryRef = new Map(
    boundaries.objects.regions.geometries.map((g) => [g.properties.name, g.properties.geometryRef]),
  )

  const regions = []

  // Constituency regions (one Region per constituency, one Seat each).
  for (const [regionName, seats] of Object.entries(CONSTITUENCY_SEATS)) {
    for (const [constituencyName, memberName, partyName] of seats) {
      const geometryRef = nameToGeometryRef.get(constituencyName)
      if (!geometryRef) {
        console.warn(
          `[fetch-holyrood-composition] No boundary match for constituency "${constituencyName}" (region ${regionName})`,
        )
      }
      const party = resolvePartySlug(partyName)
      regions.push({
        id: geometryRef ?? constituencyName,
        tier: 'holyrood',
        name: constituencyName,
        geometryRef: geometryRef ?? constituencyName,
        seats: [
          {
            regionId: geometryRef ?? constituencyName,
            party,
            memberName,
            electedAt: '2021-05-06',
          },
        ],
      })
    }
  }

  // List regions: one Region per electoral region, holding all of that
  // region's list Seat[]. No drawable geometry exists for an electoral
  // region (it's a union of many constituency boundaries, not a feature in
  // boundaries.holyrood.json), so id/geometryRef use a synthetic
  // "region:<slug>" key -- this is a naming convention introduced by this
  // script, not a key that resolves into the topojson.
  for (const [regionName, members] of Object.entries(LIST_SEATS)) {
    const slug = regionSlug(regionName)
    const id = `region:${slug}`
    regions.push({
      id,
      tier: 'holyrood',
      name: `${regionName} (region)`,
      geometryRef: id,
      seats: members.map(([memberName, partyName]) => ({
        regionId: id,
        party: resolvePartySlug(partyName),
        memberName,
        electedAt: '2021-05-06',
      })),
    })
  }

  regions.sort((a, b) => a.id.localeCompare(b.id))

  const totalSeats = regions.reduce((sum, r) => sum + r.seats.length, 0)
  console.log(`Built ${regions.length} regions, ${totalSeats} total seats.`)

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.holyrood.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(regions, null, 2))
  console.log(`Wrote ${outPath}`)
}

main()
