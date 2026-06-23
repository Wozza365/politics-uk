// Builds the party master list (Party[], src/types/party.ts) for the
// uk-2025-01-01 scenario and writes it to
// src/data/scenarios/uk-2025-01-01/parties.json.
//
// Source data below is hand-authored from public party branding (official
// colours, commonly published on each party's own brand guidance / Wikipedia
// infoboxes) and well-documented leadership facts as of 2025-01-01. This
// script does not call the Members API: colours and leadership are stable,
// slow-changing facts (not seat-by-seat data), and the API was rate-limited
// (HTTP 429, ~1hr Cloudflare cooldown) while building P0.3.2's composition.
//
// `onPrimary` is *not* hand-authored — it is computed here from `primary`
// using the WCAG 2.x relative-luminance contrast formula, and the build
// fails loudly if a colour can't hit the required 4.5:1 ratio against either
// black or white (spec §7.2).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MIN_CONTRAST = 4.5

// id matches the PartyId slugs already established by composition.commons.json
// (P0.3.2) and the placeholder fixture.
const PARTIES_SOURCE = [
  {
    id: 'labour',
    name: 'Labour Party',
    shortName: 'Lab',
    colours: { primary: '#E4003B' },
    scope: 'national',
    founded: 1900,
    mergedFrom: ['labour_coop'],
    leadership: [{ role: 'leader', personName: 'Keir Starmer', since: '2020-04-04' }],
    history: [
      {
        date: '2024-12-01',
        polling: 27.72,
        finance: { estimatedCashOnHand: 7920000, annualIncome: 35525000, source: 'estimated' },
        membership: 366300,
        commonsSeats: 402,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'conservative',
    name: 'Conservative Party',
    shortName: 'Con',
    colours: { primary: '#0087DC' },
    scope: 'national',
    founded: 1834,
    leadership: [{ role: 'leader', personName: 'Kemi Badenoch', since: '2024-11-02' }],
    history: [
      {
        date: '2024-12-01',
        polling: 24.36,
        finance: { estimatedCashOnHand: 6090000, annualIncome: 24500000, source: 'estimated' },
        membership: 131950,
        commonsSeats: 121,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'liberal_democrat',
    name: 'Liberal Democrats',
    shortName: 'LD',
    colours: { primary: '#FAA61A' },
    scope: 'national',
    founded: 1988,
    leadership: [{ role: 'leader', personName: 'Ed Davey', since: '2020-08-27' }],
    history: [
      {
        date: '2024-12-01',
        polling: 11.76,
        finance: { estimatedCashOnHand: 1470000, annualIncome: 6075000, source: 'estimated' },
        membership: 73500,
        commonsSeats: 72,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'reform_uk',
    name: 'Reform UK',
    shortName: 'RUK',
    colours: { primary: '#12B6CF' },
    scope: 'national',
    founded: 2018,
    leadership: [{ role: 'leader', personName: 'Nigel Farage', since: '2024-06-03' }],
    history: [
      {
        date: '2024-12-01',
        polling: 22.28,
        finance: { estimatedCashOnHand: 2025000, annualIncome: 7920000, source: 'estimated' },
        membership: 222750,
        commonsSeats: 5,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'green',
    name: 'Green Party of England and Wales',
    shortName: 'Green',
    colours: { primary: '#6AB023' },
    scope: 'national',
    founded: 1990,
    mergedFrom: ['scottish_greens'],
    leadership: [
      { role: 'leader', personName: 'Adrian Ramsay', since: '2024-09-06' },
      { role: 'leader', personName: 'Carla Denyer', since: '2024-09-06' },
    ],
    history: [
      {
        date: '2024-12-01',
        polling: 7.92,
        finance: { estimatedCashOnHand: 495000, annualIncome: 2030000, source: 'estimated' },
        membership: 59400,
        commonsSeats: 4,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'workers_party',
    name: 'Workers Party of Britain',
    shortName: 'WPB',
    colours: { primary: '#7A0000' },
    scope: 'national',
    founded: 2019,
    leadership: [{ role: 'leader', personName: 'George Galloway', since: '2019-01-30' }],
    history: [
      {
        date: '2024-12-01',
        polling: 1.01,
        finance: { estimatedCashOnHand: 20300, annualIncome: 98000, source: 'estimated' },
        membership: 4060,
        commonsSeats: 0,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'ukip',
    name: 'UK Independence Party',
    shortName: 'UKIP',
    colours: { primary: '#5B1A66' },
    scope: 'national',
    founded: 1993,
    leadership: [{ role: 'leader', personName: 'Nick Tenconi', since: '2024-09-21' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0.29,
        finance: { estimatedCashOnHand: 4900, annualIncome: 30375, source: 'estimated' },
        membership: 2940,
        commonsSeats: 0,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'snp',
    name: 'Scottish National Party',
    shortName: 'SNP',
    colours: { primary: '#FFF09C' },
    scope: 'regional',
    founded: 1934,
    leadership: [{ role: 'leader', personName: 'John Swinney', since: '2024-05-05' }],
    history: [
      {
        date: '2024-12-01',
        polling: 3.04,
        finance: { estimatedCashOnHand: 405000, annualIncome: 2970000, source: 'estimated' },
        membership: 50625,
        commonsSeats: 9,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'plaid_cymru',
    name: 'Plaid Cymru',
    shortName: 'PC',
    colours: { primary: '#005B54' },
    scope: 'regional',
    founded: 1925,
    leadership: [{ role: 'leader', personName: 'Rhun ap Iorwerth', since: '2023-08-19' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 99000, annualIncome: 507500, source: 'estimated' },
        membership: 9900,
        commonsSeats: 4,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'dup',
    name: 'Democratic Unionist Party',
    shortName: 'DUP',
    colours: { primary: '#D46A4C' },
    scope: 'regional',
    founded: 1971,
    leadership: [{ role: 'leader', personName: 'Gavin Robinson', since: '2024-06-29' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 152250, annualIncome: 588000, source: 'estimated' },
        membership: 5075,
        commonsSeats: 5,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'sinn_fein',
    name: 'Sinn Féin',
    shortName: 'SF',
    colours: { primary: '#326760' },
    scope: 'regional',
    founded: 1905,
    leadership: [{ role: 'leader', personName: 'Mary Lou McDonald', since: '2018-02-10' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 196000, annualIncome: 810000, source: 'estimated' },
        membership: 7840,
        commonsSeats: 7,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'sdlp',
    name: 'Social Democratic and Labour Party',
    shortName: 'SDLP',
    colours: { primary: '#2AA82C' },
    scope: 'regional',
    founded: 1970,
    leadership: [{ role: 'leader', personName: 'Claire Hanna', since: '2024-02-05' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 50625, annualIncome: 198000, source: 'estimated' },
        membership: 2025,
        commonsSeats: 2,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'alliance',
    name: 'Alliance Party of Northern Ireland',
    shortName: 'APNI',
    colours: { primary: '#F6CB2F' },
    scope: 'regional',
    founded: 1970,
    leadership: [{ role: 'leader', personName: 'Naomi Long', since: '2016-10-29' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 79200, annualIncome: 304500, source: 'estimated' },
        membership: 2970,
        commonsSeats: 1,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'uup',
    name: 'Ulster Unionist Party',
    shortName: 'UUP',
    colours: { primary: '#48A5EE' },
    scope: 'regional',
    founded: 1905,
    leadership: [{ role: 'leader', personName: 'Mike Nesbitt', since: '2024-04-08' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 40600, annualIncome: 147000, source: 'estimated' },
        membership: 2030,
        commonsSeats: 1,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'tuv',
    name: 'Traditional Unionist Voice',
    shortName: 'TUV',
    colours: { primary: '#0C3A6A' },
    scope: 'regional',
    founded: 2007,
    leadership: [{ role: 'leader', personName: 'Jim Allister', since: '2007-12-07' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 19600, annualIncome: 81000, source: 'estimated' },
        membership: 1470,
        commonsSeats: 1,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'speaker',
    name: 'Speaker of the House of Commons',
    shortName: 'Speaker',
    colours: { primary: '#4D4D4D' },
    scope: 'local',
    leadership: [{ role: 'leader', personName: 'Sir Lindsay Hoyle', since: '2019-11-04' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 0, annualIncome: 0, source: 'estimated' },
        membership: 0,
        commonsSeats: 1,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'independent',
    name: 'Independent',
    shortName: 'Ind',
    colours: { primary: '#909090' },
    scope: 'local',
    leadership: [],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 0, annualIncome: 0, source: 'estimated' },
        membership: 0,
        commonsSeats: 15,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'alba_party',
    name: 'Alba Party',
    shortName: 'Alba',
    colours: { primary: '#001489' },
    scope: 'regional',
    founded: 2021,
    leadership: [{ role: 'leader', personName: 'Alex Salmond', since: '2021-03-26' }],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 10000, annualIncome: 50000, source: 'estimated' },
        membership: 3000,
        commonsSeats: 0,
        otherSeats: 0,
      },
    ],
  },
  {
    id: 'people_before_profit',
    name: 'People Before Profit',
    shortName: 'PBP',
    colours: { primary: '#A6132B' },
    scope: 'regional',
    founded: 2005,
    leadership: [],
    history: [
      {
        date: '2024-12-01',
        polling: 0,
        finance: { estimatedCashOnHand: 8000, annualIncome: 40000, source: 'estimated' },
        membership: 1000,
        commonsSeats: 0,
        otherSeats: 0,
      },
    ],
  },
]

function srgbToLinear(c) {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const [R, G, B] = [r, g, b].map(srgbToLinear)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA]
  return (lighter + 0.05) / (darker + 0.05)
}

function pickOnPrimary(primaryHex, partyId) {
  const contrastWithWhite = contrastRatio(primaryHex, '#FFFFFF')
  const contrastWithBlack = contrastRatio(primaryHex, '#000000')
  const [best, bestContrast] =
    contrastWithWhite >= contrastWithBlack ? ['#FFFFFF', contrastWithWhite] : ['#000000', contrastWithBlack]
  if (bestContrast < MIN_CONTRAST) {
    throw new Error(
      `[build-parties] "${partyId}" primary colour ${primaryHex} cannot reach ${MIN_CONTRAST}:1 contrast ` +
        `with either black or white (best: ${best} at ${bestContrast.toFixed(2)}:1). Choose a darker/lighter shade.`,
    )
  }
  return best
}

function main() {
  const parties = PARTIES_SOURCE.map((p) => ({
    ...p,
    colours: { ...p.colours, onPrimary: pickOnPrimary(p.colours.primary, p.id) },
  }))

  const outPath = fileURLToPath(new URL('../../src/data/scenarios/uk-2025-01-01/parties.json', import.meta.url))
  writeFileSync(outPath, JSON.stringify(parties, null, 2))
  console.log(`Wrote ${outPath} (${parties.length} parties)`)
}

main()
