// Assembles the uk-2025-01-01 Scenario (src/types/scenario.ts) from the
// outputs of P0.3.1-3 (boundaries, composition.commons.json, parties.json)
// plus hand-authored polling/finance/membership snapshots, and writes
// src/data/scenarios/uk-2025-01-01/scenario.json.
//
// Provenance (see sibling sources.json for detail):
// - polling: averaged from GB-wide voting-intention polls fielded late
//   Dec 2024 / early Jan 2025 (Deltapoll, Opinium, Freshwater Strategy —
//   via Wikipedia's "Opinion polling for the next UK general election"
//   aggregation page). NI parties and Plaid Cymru aren't covered by GB-wide
//   VI polls, so they (and "don't know"/others) are left out of the map
//   rather than guessed; the map intentionally sums to < 100.
// - finances: pure estimates (spec §13 resolved: no factual basis required),
//   loosely scaled by party size. Always source: 'estimated'.
// - membership: best-effort figures from public reporting as of ~2025-01-01;
//   flagged 'estimated' throughout since exact figures aren't independently
//   verifiable from this environment.
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SCENARIO_ID = 'uk-2025-01-01'
const SCENARIO_DATE = '2025-01-01'
// Placeholder for MVP (P1.1): not a researched figure for the real next UK
// general election — just a reasonable ~5-years-out stand-in so the game
// store's daysUntilElection getter has something to compute against.
const NEXT_ELECTION_DATE_PLACEHOLDER = '2029-01-01'

// Workers Party of Britain and UKIP aren't broken out individually by most
// GB-wide voting-intention pollsters (they fall inside "other"); these two
// figures are rough indicative estimates rather than a sourced poll average,
// included so they're selectable in the party picker (spec §7.2) with a
// realistically punishing difficulty band rather than being omitted.
const POLLING = {
  labour: 28,
  conservative: 24,
  reform_uk: 22,
  liberal_democrat: 12,
  green: 8,
  workers_party: 1,
  ukip: 0.3,
  snp: 3,
}

const FINANCES = {
  labour: { estimatedCashOnHand: 8_000_000, annualIncome: 35_000_000, source: 'estimated' },
  conservative: { estimatedCashOnHand: 6_000_000, annualIncome: 25_000_000, source: 'estimated' },
  liberal_democrat: { estimatedCashOnHand: 1_500_000, annualIncome: 6_000_000, source: 'estimated' },
  reform_uk: { estimatedCashOnHand: 2_000_000, annualIncome: 8_000_000, source: 'estimated' },
  green: { estimatedCashOnHand: 500_000, annualIncome: 2_000_000, source: 'estimated' },
  workers_party: { estimatedCashOnHand: 20_000, annualIncome: 100_000, source: 'estimated' },
  ukip: { estimatedCashOnHand: 5_000, annualIncome: 30_000, source: 'estimated' },
  snp: { estimatedCashOnHand: 400_000, annualIncome: 3_000_000, source: 'estimated' },
  plaid_cymru: { estimatedCashOnHand: 100_000, annualIncome: 500_000, source: 'estimated' },
  dup: { estimatedCashOnHand: 150_000, annualIncome: 600_000, source: 'estimated' },
  sinn_fein: { estimatedCashOnHand: 200_000, annualIncome: 800_000, source: 'estimated' },
  sdlp: { estimatedCashOnHand: 50_000, annualIncome: 200_000, source: 'estimated' },
  alliance: { estimatedCashOnHand: 80_000, annualIncome: 300_000, source: 'estimated' },
  uup: { estimatedCashOnHand: 40_000, annualIncome: 150_000, source: 'estimated' },
  tuv: { estimatedCashOnHand: 20_000, annualIncome: 80_000, source: 'estimated' },
}

const MEMBERSHIP = {
  labour: 370_000,
  conservative: 130_000,
  liberal_democrat: 75_000,
  reform_uk: 220_000,
  green: 60_000,
  workers_party: 4_000,
  ukip: 3_000,
  snp: 50_000,
  plaid_cymru: 10_000,
  dup: 5_000,
  sinn_fein: 8_000,
  sdlp: 2_000,
  alliance: 3_000,
  uup: 2_000,
  tuv: 1_500,
}

function readJson(relativePath) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function main() {
  const commonsRegions = readJson('../../src/data/scenarios/uk-2025-01-01/composition.commons.json')
  const holyroodRegions = readJson('../../src/data/scenarios/uk-2025-01-01/composition.holyrood.json')
  const seneddRegions = readJson('../../src/data/scenarios/uk-2025-01-01/composition.senedd.json')
  const niAssemblyRegions = readJson('../../src/data/scenarios/uk-2025-01-01/composition.ni_assembly.json')
  const londonAssemblyRegions = readJson('../../src/data/scenarios/uk-2025-01-01/composition.london_assembly.json')
  const parties = readJson('../../src/data/scenarios/uk-2025-01-01/parties.json')

  const scenario = {
    id: SCENARIO_ID,
    date: SCENARIO_DATE,
    label: `United Kingdom, ${SCENARIO_DATE}`,
    nextElectionDate: NEXT_ELECTION_DATE_PLACEHOLDER,
    tiers: {
      commons: commonsRegions,
      holyrood: holyroodRegions,
      senedd: seneddRegions,
      ni_assembly: niAssemblyRegions,
      london_assembly: londonAssemblyRegions,
    },
    parties,
    polling: POLLING,
    // No historical snapshots authored yet — only the single scenario-start
    // polling figure above exists. Required by Scenario (src/types/scenario.ts)
    // and read by stores/game.ts on game start.
    pollingHistory: [],
    finances: FINANCES,
    membership: MEMBERSHIP,
  }

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/scenario.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(scenario, null, 2))
  console.log(`Wrote ${outPath}`)
}

main()
