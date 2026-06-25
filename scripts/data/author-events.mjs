import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const DEFAULT_OUT = 'src/data/scenarios/uk-2025-01-01/events.ideas.json'
const DEFAULT_COUNT = 3000

const SCOPES = ['local', 'regional', 'national', 'international']
const SEVERITIES = ['minor', 'moderate', 'major']

const PARTY_PROFILES = {
  labour: { economic: -0.35, social: -0.15, green: 0.45, immigration: -0.15, europe: 0.45, devolution: 0.25, unionism: 0.25, antiWar: 0.2, establishment: 0.55 },
  conservative: { economic: 0.55, social: 0.35, green: -0.15, immigration: 0.45, europe: -0.2, devolution: -0.25, unionism: 0.85, antiWar: -0.2, establishment: 0.7 },
  liberal_democrat: { economic: -0.05, social: -0.55, green: 0.65, immigration: -0.45, europe: 0.8, devolution: 0.35, unionism: 0.15, antiWar: 0.25, establishment: 0.45 },
  reform_uk: { economic: 0.35, social: 0.8, green: -0.65, immigration: 0.95, europe: -0.9, devolution: -0.15, unionism: 0.6, antiWar: -0.1, establishment: -0.65 },
  green: { economic: -0.65, social: -0.7, green: 0.98, immigration: -0.65, europe: 0.65, devolution: 0.45, unionism: -0.1, antiWar: 0.65, establishment: -0.35 },
  workers_party: { economic: -0.85, social: 0.15, green: 0.25, immigration: 0.05, europe: -0.15, devolution: 0.15, unionism: 0.05, antiWar: 0.95, establishment: -0.75 },
  ukip: { economic: 0.25, social: 0.9, green: -0.75, immigration: 0.95, europe: -1, devolution: -0.25, unionism: 0.8, antiWar: -0.05, establishment: -0.55 },
  snp: { economic: -0.35, social: -0.45, green: 0.55, immigration: -0.45, europe: 0.75, devolution: 0.95, unionism: -0.95, antiWar: 0.35, establishment: 0.15 },
  plaid_cymru: { economic: -0.45, social: -0.45, green: 0.7, immigration: -0.4, europe: 0.7, devolution: 0.9, unionism: -0.85, antiWar: 0.35, establishment: 0 },
  dup: { economic: 0.25, social: 0.8, green: -0.25, immigration: 0.35, europe: -0.65, devolution: -0.2, unionism: 1, antiWar: -0.15, establishment: 0.25 },
  sinn_fein: { economic: -0.65, social: -0.35, green: 0.45, immigration: -0.45, europe: 0.65, devolution: 1, unionism: -1, antiWar: 0.45, establishment: -0.45 },
  sdlp: { economic: -0.35, social: -0.4, green: 0.45, immigration: -0.35, europe: 0.65, devolution: 0.75, unionism: -0.65, antiWar: 0.35, establishment: 0.1 },
  alliance: { economic: -0.05, social: -0.5, green: 0.5, immigration: -0.35, europe: 0.65, devolution: 0.15, unionism: -0.1, antiWar: 0.25, establishment: 0.25 },
  uup: { economic: 0.35, social: 0.45, green: -0.1, immigration: 0.3, europe: -0.35, devolution: -0.15, unionism: 0.9, antiWar: -0.1, establishment: 0.35 },
  tuv: { economic: 0.35, social: 0.85, green: -0.35, immigration: 0.55, europe: -0.8, devolution: -0.45, unionism: 1, antiWar: -0.1, establishment: -0.35 },
  alba_party: { economic: -0.25, social: -0.2, green: 0.35, immigration: -0.25, europe: 0.55, devolution: 1, unionism: -1, antiWar: 0.25, establishment: -0.35 },
  people_before_profit: { economic: -0.95, social: -0.45, green: 0.55, immigration: -0.5, europe: 0.2, devolution: 0.7, unionism: -0.7, antiWar: 0.9, establishment: -0.85 },
}

const CATEGORIES = [
  { id: 'nhs_waiting_lists', policyId: 'health_nhs', label: 'NHS waiting lists', vector: { economic: -0.45, social: -0.05 }, salience: 0.04 },
  { id: 'tax_cuts', policyId: 'economy_tax', label: 'tax cuts', vector: { economic: 0.8, social: 0.15 }, salience: 0.04 },
  { id: 'windfall_tax', policyId: 'economy_tax', label: 'windfall taxes', vector: { economic: -0.75, social: -0.05 }, salience: 0.035 },
  { id: 'benefits_crackdown', policyId: 'welfare_benefits', label: 'benefit conditionality', vector: { economic: 0.45, social: 0.55 }, salience: 0.03 },
  { id: 'trade_union_rights', policyId: 'trade_unions_workers_rights', label: 'trade union rights', vector: { economic: -0.8, social: -0.15 }, salience: 0.03 },
  { id: 'small_boats', policyId: 'immigration', label: 'small boats and asylum', vector: { economic: 0.15, social: 0.9, immigration: 1 }, salience: 0.055 },
  { id: 'student_visas', policyId: 'immigration', label: 'student and work visas', vector: { economic: -0.05, social: -0.45, immigration: -0.7 }, salience: 0.035 },
  { id: 'net_zero', policyId: 'environment_net_zero', label: 'net zero targets', vector: { economic: -0.25, social: -0.55, green: 1 }, salience: 0.05 },
  { id: 'north_sea_oil', policyId: 'energy_mix', label: 'North Sea oil and gas', vector: { economic: 0.25, social: 0.35, green: -0.8 }, salience: 0.035 },
  { id: 'nuclear_power', policyId: 'energy_mix', label: 'nuclear power', vector: { economic: 0.15, social: 0.15, green: -0.1 }, salience: 0.025 },
  { id: 'brexit_reset', policyId: 'europe_brexit', label: 'EU relations', vector: { economic: -0.05, social: -0.45, europe: 1 }, salience: 0.045 },
  { id: 'sovereignty_row', policyId: 'europe_brexit', label: 'Brexit sovereignty', vector: { economic: 0.2, social: 0.65, europe: -1 }, salience: 0.04 },
  { id: 'law_and_order', policyId: 'law_order', label: 'law and order', vector: { economic: 0.15, social: 0.75 }, salience: 0.04 },
  { id: 'civil_liberties', policyId: 'law_order', label: 'civil liberties', vector: { economic: -0.1, social: -0.8 }, salience: 0.03 },
  { id: 'housebuilding', policyId: 'housing', label: 'housebuilding', vector: { economic: -0.2, social: -0.25 }, salience: 0.045 },
  { id: 'planning_suburbs', policyId: 'housing', label: 'suburban planning reform', vector: { economic: 0.25, social: 0.15 }, salience: 0.035 },
  { id: 'rail_nationalisation', policyId: 'transport_infrastructure', label: 'rail ownership', vector: { economic: -0.8, social: -0.15 }, salience: 0.035 },
  { id: 'motoring_costs', policyId: 'transport_infrastructure', label: 'motoring costs', vector: { economic: 0.35, social: 0.45, green: -0.55 }, salience: 0.025 },
  { id: 'tuition_fees', policyId: 'tuition_fees', label: 'tuition fees', vector: { economic: -0.65, social: -0.35 }, salience: 0.025 },
  { id: 'schools_curriculum', policyId: 'education_schools', label: 'schools curriculum', vector: { economic: 0, social: 0.55 }, salience: 0.03 },
  { id: 'defence_spending', policyId: 'defence_foreign', label: 'defence spending', vector: { economic: 0.2, social: 0.45, antiWar: -0.6 }, salience: 0.04 },
  { id: 'foreign_war', policyId: 'defence_foreign', label: 'foreign military action', vector: { economic: 0.1, social: 0.45, antiWar: -1 }, salience: 0.055 },
  { id: 'gaza_ceasefire', policyId: 'defence_foreign', label: 'Middle East ceasefire calls', vector: { economic: -0.35, social: -0.25, antiWar: 1 }, salience: 0.045 },
  { id: 'devolution', policyId: 'constitution_devolution', label: 'devolution powers', vector: { economic: -0.15, social: -0.25, devolution: 1, unionism: -0.7 }, salience: 0.035 },
  { id: 'unionism', policyId: 'constitution_devolution', label: 'Union politics', vector: { economic: 0.15, social: 0.45, unionism: 1, devolution: -0.75 }, salience: 0.035 },
  { id: 'electoral_reform', policyId: 'electoral_reform', label: 'proportional representation', vector: { economic: -0.1, social: -0.45, establishment: -0.35 }, salience: 0.025 },
  { id: 'lords_reform', policyId: 'lords_reform', label: 'House of Lords reform', vector: { economic: -0.15, social: -0.35, establishment: -0.5 }, salience: 0.025 },
  { id: 'monarchy', policyId: 'monarchy_republic', label: 'the monarchy', vector: { economic: 0.15, social: 0.55, establishment: 0.55 }, salience: 0.02 },
  { id: 'assisted_dying', policyId: 'assisted_dying', label: 'assisted dying', vector: { economic: -0.05, social: -0.7 }, salience: 0.03 },
  { id: 'gender_policy', policyId: 'lgbtq_rights', label: 'gender recognition policy', vector: { economic: -0.05, social: -0.8 }, salience: 0.035 },
  { id: 'farming', policyId: 'farming_fishing', label: 'farming and food standards', vector: { economic: 0.25, social: 0.35, green: -0.15 }, salience: 0.025 },
  { id: 'fishing', policyId: 'farming_fishing', label: 'fishing rights', vector: { economic: 0.25, social: 0.55, europe: -0.55 }, salience: 0.025 },
  { id: 'animal_welfare', policyId: 'animal_welfare', label: 'animal welfare', vector: { economic: -0.25, social: -0.55, green: 0.75 }, salience: 0.02 },
  { id: 'drug_law', policyId: 'drugs_policy', label: 'drug law reform', vector: { economic: -0.1, social: -0.85 }, salience: 0.025 },
  { id: 'gambling', policyId: 'gambling_regulation', label: 'gambling regulation', vector: { economic: -0.25, social: -0.35 }, salience: 0.02 },
  { id: 'press_freedom', policyId: 'press_regulation', label: 'press regulation', vector: { economic: 0.1, social: -0.45 }, salience: 0.02 },
  { id: 'foreign_aid', policyId: 'foreign_aid', label: 'foreign aid', vector: { economic: -0.35, social: -0.35, antiWar: 0.35 }, salience: 0.025 },
]

const CATALYSTS = [
  { id: 'minister_gaffe', title: 'minister gaffe', scale: 0.08, scope: 'national', severity: 'minor', verb: 'mishandles', targetValence: -1 },
  { id: 'leaked_memo', title: 'leaked memo', scale: 0.14, scope: 'national', severity: 'moderate', verb: 'reveals internal splits over', targetValence: -1 },
  { id: 'frontbench_resignation', title: 'frontbench resignation', scale: 0.18, scope: 'national', severity: 'moderate', verb: 'forces a public reckoning on', targetValence: -1 },
  { id: 'court_ruling', title: 'court ruling', scale: 0.16, scope: 'national', severity: 'moderate', verb: 'rewrites the politics of', targetValence: 0 },
  { id: 'select_committee_report', title: 'select committee report', scale: 0.09, scope: 'national', severity: 'minor', verb: 'criticises the government on', targetValence: -1 },
  { id: 'think_tank_plan', title: 'think-tank plan', scale: 0.06, scope: 'national', severity: 'minor', verb: 'puts numbers behind', targetValence: 0 },
  { id: 'viral_clip', title: 'viral clip', scale: 0.07, scope: 'national', severity: 'minor', verb: 'turns a throwaway line about', targetValence: -1 },
  { id: 'by_election', title: 'by-election', scale: 0.13, scope: 'regional', severity: 'moderate', verb: 'becomes a proxy fight over', targetValence: 0 },
  { id: 'council_row', title: 'council row', scale: 0.06, scope: 'local', severity: 'minor', verb: 'drags local campaigners into', targetValence: -1 },
  { id: 'strike_wave', title: 'strike wave', scale: 0.16, scope: 'national', severity: 'moderate', verb: 'raises the stakes on', targetValence: 0 },
  { id: 'budget_surprise', title: 'Budget surprise', scale: 0.2, scope: 'national', severity: 'major', verb: 'lands a sharp turn on', targetValence: 0 },
  { id: 'spending_review', title: 'spending review', scale: 0.17, scope: 'national', severity: 'moderate', verb: 'sets hard choices around', targetValence: 0 },
  { id: 'international_crisis', title: 'international crisis', scale: 0.22, scope: 'international', severity: 'major', verb: 'forces parties to choose language on', targetValence: 0 },
  { id: 'public_inquiry', title: 'public inquiry', scale: 0.18, scope: 'national', severity: 'major', verb: 'publishes damning evidence about', targetValence: -1 },
  { id: 'data_release', title: 'official data release', scale: 0.08, scope: 'national', severity: 'minor', verb: 'keeps attention fixed on', targetValence: 0 },
  { id: 'celebrity_intervention', title: 'celebrity intervention', scale: 0.05, scope: 'national', severity: 'minor', verb: 'briefly amplifies', targetValence: 1 },
  { id: 'business_warning', title: 'business warning', scale: 0.11, scope: 'national', severity: 'moderate', verb: 'puts boardroom pressure on', targetValence: -1 },
  { id: 'union_ballot', title: 'union ballot', scale: 0.1, scope: 'regional', severity: 'minor', verb: 'makes doorstep questions about', targetValence: 0 },
  { id: 'devolved_vote', title: 'devolved parliament vote', scale: 0.12, scope: 'regional', severity: 'moderate', verb: 'sets nations against Westminster over', targetValence: 0 },
  { id: 'local_disaster', title: 'local disaster response', scale: 0.1, scope: 'local', severity: 'moderate', verb: 'tests competence around', targetValence: -1 },
]

const FRAMES = [
  { id: 'principled', label: 'principled stand', targetMultiplier: 0.75, alignmentMultiplier: 1.15 },
  { id: 'u_turn', label: 'u-turn', targetMultiplier: 1.35, alignmentMultiplier: 0.8 },
  { id: 'base_betrayal', label: 'base-betrayal row', targetMultiplier: 1.6, alignmentMultiplier: 0.75 },
  { id: 'competence', label: 'competence test', targetMultiplier: 0.9, alignmentMultiplier: 0.9 },
  { id: 'hypocrisy', label: 'hypocrisy attack', targetMultiplier: 1.25, alignmentMultiplier: 0.8 },
  { id: 'coalition_signal', label: 'coalition signal', targetMultiplier: 0.7, alignmentMultiplier: 0.85 },
  { id: 'culture_war', label: 'culture-war flare-up', targetMultiplier: 1, alignmentMultiplier: 1.1 },
  { id: 'technocratic', label: 'technocratic fix', targetMultiplier: 0.55, alignmentMultiplier: 0.75 },
]

const RESPONSE_STRATEGIES = [
  { id: 'hold_line', label: 'Hold the line', drift: 0.12, effect: 0.08, risk: 0.25 },
  { id: 'soften_language', label: 'Soften the language', drift: -0.08, effect: 0.04, risk: 0.15 },
  { id: 'double_down', label: 'Double down', drift: 0.22, effect: 0.13, risk: 0.45 },
  { id: 'distance', label: 'Distance the party from it', drift: -0.18, effect: 0.09, risk: 0.35 },
  { id: 'call_inquiry', label: 'Call for an inquiry', drift: -0.03, effect: 0.03, risk: 0.1 },
  { id: 'localise', label: 'Make it a local competence issue', drift: 0.02, effect: 0.04, risk: 0.12 },
  { id: 'attack_government', label: "Attack the government's record", drift: 0.1, effect: 0.07, risk: 0.2 },
  { id: 'cross_party', label: 'Seek a cross-party line', drift: -0.12, effect: 0.04, risk: 0.18 },
  { id: 'quiet_briefing', label: 'Brief journalists off the record', drift: 0.04, effect: 0.03, risk: 0.3 },
  { id: 'no_comment', label: 'Say nothing publicly', drift: 0, effect: -0.02, risk: 0.05 },
]

const WINDOW_PATTERNS = [
  { id: 'anytime_short', startMonth: 1, startDay: 1, endMonth: 12, endDay: 31, repeat: 'none' },
  { id: 'spring_budget', startMonth: 3, startDay: 1, endMonth: 4, endDay: 15, repeat: 'yearly' },
  { id: 'local_election_season', startMonth: 4, startDay: 1, endMonth: 5, endDay: 31, repeat: 'yearly' },
  { id: 'summer', startMonth: 6, startDay: 1, endMonth: 8, endDay: 31, repeat: 'yearly' },
  { id: 'conference_season', startMonth: 9, startDay: 1, endMonth: 10, endDay: 20, repeat: 'yearly' },
  { id: 'autumn_budget', startMonth: 10, startDay: 15, endMonth: 11, endDay: 30, repeat: 'yearly' },
  { id: 'winter_pressure', startMonth: 12, startDay: 1, endMonth: 2, endDay: 28, repeat: 'yearly' },
  { id: 'campaign_period', startMonth: 5, startDay: 1, endMonth: 7, endDay: 15, repeat: 'election-cycle' },
]

function usage() {
  console.log(`Usage:
  node scripts/data/author-events.mjs generate-ideas [--count 3000] [--out ${DEFAULT_OUT}]
  node scripts/data/author-events.mjs validate-ideas [--in ${DEFAULT_OUT}]
  node scripts/data/author-events.mjs draft-text [--in ${DEFAULT_OUT}] [--out .generated/events.drafts.json] [--limit 25]
  node scripts/data/author-events.mjs export-game-events [--in ${DEFAULT_OUT}] [--out .generated/events.candidates.json] [--limit 100]

Environment for draft-text:
  AUTHOR_EVENTS_API_URL       Chat-completions compatible endpoint.
  AUTHOR_EVENTS_API_KEY       Optional bearer token.
  AUTHOR_EVENTS_MODEL         Optional model name.

The default generate-ideas mode is offline and deterministic; it does not call an LLM.`)
}

function argValue(args, name, fallback) {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}

function readJson(path) {
  return JSON.parse(readFileSync(`${ROOT}${path}`, 'utf-8'))
}

function writeJson(path, value) {
  const absolute = `${ROOT}${path}`
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`)
  console.log(`Wrote ${absolute}`)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function hash(input) {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededNoise(key, amplitude = 1) {
  return (((hash(key) % 10000) / 9999) * 2 - 1) * amplitude
}

function seededUnit(key) {
  return (hash(key) % 10000) / 9999
}

function dotProfile(profile, vector) {
  let total = 0
  let weight = 0
  for (const [axis, value] of Object.entries(vector)) {
    if (profile[axis] === undefined) continue
    total += profile[axis] * value
    weight += Math.abs(value)
  }
  return weight === 0 ? 0 : total / weight
}

function bandForMagnitude(magnitude) {
  const abs = Math.abs(magnitude)
  if (abs < 0.025) return 'negligible'
  if (abs < 0.08) return 'minor'
  if (abs < 0.18) return 'moderate'
  if (abs < 0.35) return 'major'
  return 'severe'
}

function directionForMagnitude(magnitude) {
  if (magnitude > 0.01) return 'positive'
  if (magnitude < -0.01) return 'negative'
  return 'neutral'
}

function partyRationale(party, category, magnitude, frame, targetPartyId, catalyst, alignment) {
  const direction = directionForMagnitude(magnitude)
  const band = bandForMagnitude(magnitude)
  if (direction === 'neutral') return `Almost no direct read-across for ${party.shortName}; ${category.label} is not central to its current lane.`
  if (party.id === targetPartyId) {
    if (magnitude < 0) {
      const issueFit = alignment >= 0 ? 'even though the issue normally fits its voter coalition' : 'and the issue also cuts against its voter coalition'
      return `${band} negative effect as the party at the centre of the story: the ${catalyst.title} frame damages ${party.shortName} ${issueFit}.`
    }
    return `${band} positive effect as the party at the centre of the story: the ${catalyst.title} frame lets ${party.shortName} own ${category.label} on favourable terms.`
  }
  const targetText = party.id === targetPartyId ? ' as the party at the centre of the story' : ''
  return `${band} ${direction} effect${targetText}: ${category.label} ${direction === 'positive' ? 'fits' : 'cuts against'} ${party.shortName}'s likely voter coalition under a ${frame.label}.`
}

function eventValence(catalyst, index) {
  if (catalyst.targetValence !== 0) return catalyst.targetValence
  return hash(`${index}:polarity`) % 2 === 0 ? 1 : -1
}

function selectableParties(parties) {
  return parties.filter((party) => party.scope !== 'local' && PARTY_PROFILES[party.id])
}

function partyPopularity(party, scenario) {
  const polling = scenario.polling?.[party.id] ?? 0
  const commonsSeats = party.history?.at(-1)?.commonsSeats ?? 0
  const seatProxy = (commonsSeats / 650) * 45
  const regionalDamping = party.scope === 'regional' ? 0.35 : 1
  return Math.max(0.08, (polling + seatProxy) * regionalDamping)
}

function weightedParty(index, parties, popularity) {
  const total = parties.reduce((sum, party) => sum + popularity[party.id], 0)
  let pick = seededUnit(`target-party:${index}`) * total
  for (const party of parties) {
    pick -= popularity[party.id]
    if (pick <= 0) return party
  }
  return parties[parties.length - 1]
}

function likelyInvolvedPartyIds(index, parties, popularity, targetParty, scope, severity) {
  const ids = new Set([targetParty.id])
  const sorted = [...parties].sort((a, b) => popularity[b.id] - popularity[a.id])
  const maxExtra = severity === 'major' ? 5 : severity === 'moderate' ? 3 : 2
  for (const party of sorted) {
    if (party.id === targetParty.id) continue
    const baseChance = clamp(popularity[party.id] / 30, 0.02, 0.75)
    const scopeDamping = party.scope === 'regional' && scope === 'national' ? 0.45 : 1
    const chance = baseChance * scopeDamping * (severity === 'major' ? 1.4 : severity === 'moderate' ? 1 : 0.65)
    if (seededUnit(`involved:${index}:${party.id}`) < chance) ids.add(party.id)
    if (ids.size >= maxExtra + 1) break
  }
  return [...ids]
}

function yearWindow(year, pattern) {
  const startYear = pattern.startMonth > pattern.endMonth ? year - 1 : year
  const from = `${startYear}-${String(pattern.startMonth).padStart(2, '0')}-${String(pattern.startDay).padStart(2, '0')}`
  const to = `${year}-${String(pattern.endMonth).padStart(2, '0')}-${String(pattern.endDay).padStart(2, '0')}`
  return { from, to }
}

function makeWindow(index, category, catalyst) {
  const patternIndex =
    category.id.includes('net_zero') || category.id.includes('north_sea') || category.id.includes('motoring')
      ? 3
      : catalyst.id.includes('budget')
        ? 5
        : catalyst.id.includes('by_election') || catalyst.id.includes('council')
          ? 2
          : hash(`window:${index}`) % WINDOW_PATTERNS.length
  const pattern = WINDOW_PATTERNS[patternIndex]
  const baseYear = 2025 + (hash(`year:${index}`) % 4)
  const window = yearWindow(baseYear, pattern)
  const repeatableWindows =
    pattern.repeat === 'yearly'
      ? [2025, 2026, 2027, 2028].map((year) => yearWindow(year, pattern))
      : [window]
  return {
    pattern: pattern.id,
    repeat: pattern.repeat,
    from: window.from,
    to: window.to,
    repeatableWindows,
  }
}

function responseOption(index, party, category, baseImpact, strategy, ordinal) {
  const profile = PARTY_PROFILES[party.id]
  const alignment = dotProfile(profile, category.vector)
  const direction = alignment >= 0 ? 1 : -1
  const driftMagnitude = strategy.drift * direction
  const baseMagnitude = baseImpact.magnitude
  const voterFit = alignment * strategy.effect
  const riskPenalty = Math.abs(strategy.drift) * strategy.risk * (alignment < -0.15 ? 1.25 : 0.6)
  const pollingModifier = clamp(voterFit - riskPenalty + seededNoise(`response:${index}:${party.id}:${strategy.id}`, 0.025), -0.5, 0.5)
  const totalMagnitude = clamp(baseMagnitude + pollingModifier, -1, 1)
  return {
    id: `${strategy.id}-${ordinal + 1}`,
    label: strategy.label,
    pollingModifier: Math.round(pollingModifier * 1000) / 1000,
    resultingMagnitude: Math.round(totalMagnitude * 1000) / 1000,
    stanceDrift: {
      policyId: category.policyId,
      economic: Math.round((category.vector.economic ?? 0) * driftMagnitude * 1000) / 1000,
      social: Math.round((category.vector.social ?? 0) * driftMagnitude * 1000) / 1000,
      description:
        driftMagnitude === 0
          ? 'No stance movement; the party banks or absorbs the story as-is.'
          : driftMagnitude > 0
            ? `Drifts further into its ${category.label} lane over time.`
            : `Drifts away from its current ${category.label} lane over time.`,
    },
    risk: strategy.risk,
    rationale: `${strategy.label} changes ${party.shortName}'s event impact from ${baseMagnitude} to ${Math.round(totalMagnitude * 1000) / 1000}.`,
  }
}

function responseSet(index, party, category, impact, involvedPartyIds, popularity, severity) {
  const involved = involvedPartyIds.includes(party.id)
  const partyWeight = popularity[party.id]
  const noResponseChance = involved
    ? severity === 'minor'
      ? 0.18
      : 0.08
    : clamp(0.98 - partyWeight / 35, 0.45, 0.995)
  if (seededUnit(`no-response:${index}:${party.id}`) < noResponseChance) {
    return {
      canRespond: false,
      reason: involved
        ? 'This is treated as a passing story for this party; intervening would look forced.'
        : 'The event is too distant from this party or its likely media orbit to justify a meaningful response.',
      options: [],
    }
  }

  const maxOptions = severity === 'major' ? 5 : severity === 'moderate' ? 4 : 3
  const minOptions = involved ? 2 : 1
  const spread = Math.max(0, maxOptions - minOptions)
  const optionCount = minOptions + Math.floor(seededUnit(`option-count:${index}:${party.id}`) * (spread + 1))
  const ranked = [...RESPONSE_STRATEGIES].sort(
    (a, b) => seededUnit(`strategy:${index}:${party.id}:${a.id}`) - seededUnit(`strategy:${index}:${party.id}:${b.id}`),
  )
  return {
    canRespond: true,
    reason: involved ? 'The party is directly in the story or has enough profile to shape the follow-up.' : 'Optional opportunistic response.',
    options: ranked.slice(0, optionCount).map((strategy, ordinal) => responseOption(index, party, category, impact, strategy, ordinal)),
  }
}

function makeIdea(index, parties, policies, scenario, popularity) {
  const category = CATEGORIES[index % CATEGORIES.length]
  const catalyst = CATALYSTS[Math.floor(index / CATEGORIES.length) % CATALYSTS.length]
  const frame = FRAMES[Math.floor(index / (CATEGORIES.length * CATALYSTS.length)) % FRAMES.length]
  const targetParty = weightedParty(index, parties, popularity)
  const valence = eventValence(catalyst, index)
  const scope = catalyst.scope
  const severity = catalyst.severity
  const window = makeWindow(index, category, catalyst)
  const involvedPartyIds = likelyInvolvedPartyIds(index, parties, popularity, targetParty, scope, severity)
  const majorMultiplier = severity === 'major' ? 1.45 : severity === 'moderate' ? 1 : 0.55
  const targetProfile = PARTY_PROFILES[targetParty.id]
  const targetAlignment = dotProfile(targetProfile, category.vector)
  const targetEffect = valence * catalyst.scale * majorMultiplier * frame.targetMultiplier
  const targetBetrayal = targetAlignment < -0.2 && valence > 0 ? Math.abs(targetAlignment) * -0.25 : 0
  const impacts = {}

  for (const party of parties) {
    const profile = PARTY_PROFILES[party.id]
    const alignment = dotProfile(profile, category.vector)
    const contrastWithTarget = alignment - targetAlignment
    const targetShare = popularity[targetParty.id] / (popularity[targetParty.id] + popularity[party.id])
    const opponentOpportunity = party.id === targetParty.id ? 0 : -valence * catalyst.scale * majorMultiplier * targetShare * 0.35
    const alignmentEffect = contrastWithTarget * catalyst.scale * majorMultiplier * frame.alignmentMultiplier * 0.45
    const base =
      party.id === targetParty.id
        ? targetEffect + targetBetrayal
        : opponentOpportunity + alignmentEffect
    const sizeDamping = party.scope === 'regional' && scope === 'national' ? 0.75 : 1
    const localDamping = scope === 'local' ? 0.4 : 1
    const noise = seededNoise(`${index}:${party.id}`, catalyst.scale * 0.18)
    const magnitude = clamp(base * sizeDamping * localDamping + noise, -1, 1)
    impacts[party.id] = {
      magnitude: Math.round(magnitude * 1000) / 1000,
      direction: directionForMagnitude(magnitude),
      band: bandForMagnitude(magnitude),
      rationale: partyRationale(party, category, magnitude, frame, targetParty.id, catalyst, alignment),
    }
  }

  const responses = {}
  for (const party of parties) {
    responses[party.id] = responseSet(index, party, category, impacts[party.id], involvedPartyIds, popularity, severity)
  }

  const policy = policies.find((entry) => entry.id === category.policyId)
  const headline = `${targetParty.shortName} ${catalyst.verb} ${category.label}`
  const id = `idea-${String(index + 1).padStart(5, '0')}-${targetParty.id}-${catalyst.id}-${category.id}-${frame.id}`
  return {
    id,
    headline,
    premise: `A ${catalyst.title} ${catalyst.verb} ${category.label}, framed as a ${frame.label}.`,
    authoringStatus: 'idea',
    scope,
    severity,
    window,
    category: category.id,
    frame: frame.id,
    targetPartyId: targetParty.id,
    involvedPartyIds,
    targetWeightBasis: {
      popularity: Math.round(popularity[targetParty.id] * 1000) / 1000,
      note: 'Target party chosen by deterministic weighted draw from scenario polling plus a damped Commons seat proxy.',
    },
    policies: [category.policyId],
    salienceShift: { [category.policyId]: Math.round(category.salience * majorMultiplier * 1000) / 1000 },
    suggestedWeight: severity === 'major' ? 2 : severity === 'moderate' ? 4 : 6,
    impactScale: '-1 to +1 polling-impact magnitude, before runtime caps and poll-release normalisation',
    impactSummary: {
      strongestPositive: Object.entries(impacts).sort((a, b) => b[1].magnitude - a[1].magnitude)[0][0],
      strongestNegative: Object.entries(impacts).sort((a, b) => a[1].magnitude - b[1].magnitude)[0][0],
    },
    impacts,
    responses,
    notes: policy ? `${policy.name} (${policy.tier})` : category.label,
  }
}

function generateIdeas(args) {
  const count = Number(argValue(args, '--count', DEFAULT_COUNT))
  const out = argValue(args, '--out', DEFAULT_OUT)
  const parties = selectableParties(readJson('src/data/scenarios/uk-2025-01-01/parties.json'))
  const scenario = readJson('src/data/scenarios/uk-2025-01-01/scenario.json')
  const popularity = Object.fromEntries(parties.map((party) => [party.id, partyPopularity(party, scenario)]))
  const policyData = readJson('src/data/sim/policies.json')
  const ideas = Array.from({ length: count }, (_, index) => makeIdea(index, parties, policyData.policies, scenario, popularity))
  writeJson(out, {
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: 'scripts/data/author-events.mjs generate-ideas',
      count: ideas.length,
      purpose: 'Authoring backlog for P2.6. Review/edit/export before committing runtime GameEvent records.',
      parties: parties.map((party) => party.id),
      targetWeightBasis: popularity,
    },
    ideas,
  })
}

function validateIdeas(args) {
  const input = argValue(args, '--in', DEFAULT_OUT)
  const { ideas } = readJson(input)
  const negativeCatalysts = new Set(
    CATALYSTS.filter((catalyst) => catalyst.targetValence < 0).map((catalyst) => catalyst.id),
  )
  const errors = []

  for (const idea of ideas) {
    if (!idea.window?.from || !idea.window?.to) errors.push(`${idea.id}: missing start/end window`)
    if (!idea.responses || Object.keys(idea.responses).length === 0) errors.push(`${idea.id}: missing party responses`)

    const negativeCatalyst = [...negativeCatalysts].find((id) => idea.id.includes(`-${id}-`))
    if (negativeCatalyst) {
      const targetImpact = idea.impacts?.[idea.targetPartyId]
      if (!targetImpact) errors.push(`${idea.id}: missing target-party impact`)
      if (targetImpact?.magnitude > 0.01) {
        errors.push(`${idea.id}: ${negativeCatalyst} gives ${idea.targetPartyId} a positive target impact`)
      }
    }

    for (const [partyId, response] of Object.entries(idea.responses ?? {})) {
      if (!response.canRespond && response.options?.length) errors.push(`${idea.id}/${partyId}: no-response has options`)
      if (response.canRespond && (response.options.length < 1 || response.options.length > 5)) {
        errors.push(`${idea.id}/${partyId}: response option count must be 1-5`)
      }
      for (const option of response.options ?? []) {
        if (typeof option.pollingModifier !== 'number') errors.push(`${idea.id}/${partyId}/${option.id}: missing polling modifier`)
        if (!option.stanceDrift?.policyId) errors.push(`${idea.id}/${partyId}/${option.id}: missing stance drift`)
      }
    }
  }

  if (errors.length > 0) {
    console.error(errors.slice(0, 50).join('\n'))
    if (errors.length > 50) console.error(`...and ${errors.length - 50} more`)
    process.exitCode = 1
    return
  }

  console.log(`Validated ${ideas.length} event ideas`)
}

function ideaToGameEvent(idea) {
  return {
    id: idea.id.replace(/^idea-/, 'candidate-'),
    headline: idea.headline,
    body: idea.premise,
    scope: idea.scope,
    severity: idea.severity,
    weight: idea.suggestedWeight,
    window: { from: idea.window.from, to: idea.window.to },
    effects: {
      polling: Object.entries(idea.impacts)
        .filter(([, impact]) => Math.abs(impact.magnitude) >= 0.025)
        .map(([partyId, impact]) => ({ partyId, magnitude: impact.magnitude })),
      salienceShift: idea.salienceShift,
      summary: `Draft generated from ${idea.id}; review text and magnitudes before adding to seed/scripted pools.`,
    },
    authoringResponses: idea.responses,
  }
}

function exportGameEvents(args) {
  const input = argValue(args, '--in', DEFAULT_OUT)
  const out = argValue(args, '--out', '.generated/events.candidates.json')
  const limit = Number(argValue(args, '--limit', 100))
  const { ideas } = readJson(input)
  writeJson(out, ideas.slice(0, limit).map(ideaToGameEvent))
}

async function draftText(args) {
  const apiUrl = process.env.AUTHOR_EVENTS_API_URL
  if (!apiUrl) throw new Error('Set AUTHOR_EVENTS_API_URL to use draft-text.')
  const input = argValue(args, '--in', DEFAULT_OUT)
  const out = argValue(args, '--out', '.generated/events.drafts.json')
  const limit = Number(argValue(args, '--limit', 25))
  const model = process.env.AUTHOR_EVENTS_MODEL ?? 'text-generator'
  const apiKey = process.env.AUTHOR_EVENTS_API_KEY
  const { ideas } = readJson(input)
  const drafts = []

  for (const idea of ideas.slice(0, limit)) {
    const prompt = `Turn this UK politics simulator event idea into concise GameEvent text.
Return JSON with headline, body, summary only. Do not change numeric effects.
${JSON.stringify({
      headline: idea.headline,
      premise: idea.premise,
      scope: idea.scope,
      severity: idea.severity,
      window: idea.window,
      policies: idea.policies,
      impactSummary: idea.impactSummary,
      responses: idea.responses,
    })}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You draft flavour text for a deterministic UK politics simulation. Be specific, plausible, and compact.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
      }),
    })
    if (!response.ok) throw new Error(`LLM request failed: ${response.status} ${await response.text()}`)
    const json = await response.json()
    const content = json.choices?.[0]?.message?.content ?? json.output_text ?? ''
    drafts.push({ ideaId: idea.id, raw: content })
  }

  writeJson(out, drafts)
}

const [command, ...args] = process.argv.slice(2)
if (!command || command === '--help' || command === '-h') {
  usage()
} else if (command === 'generate-ideas') {
  generateIdeas(args)
} else if (command === 'validate-ideas') {
  validateIdeas(args)
} else if (command === 'export-game-events') {
  exportGameEvents(args)
} else if (command === 'draft-text') {
  await draftText(args)
} else {
  usage()
  process.exitCode = 1
}
