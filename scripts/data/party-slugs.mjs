// Shared party-name -> slug resolution, used by every fetch script that
// touches Members API party names (spec §4.3 merges + the slugs already
// established by the placeholder fixture,
// src/data/scenarios/uk-2025-01-01/composition.placeholder.json).
export const PARTY_SLUGS = {
  Conservative: 'conservative',
  Labour: 'labour',
  'Labour (Co-op)': 'labour',
  'Scottish National Party': 'snp',
  'Liberal Democrat': 'liberal_democrat',
  'Reform UK': 'reform_uk',
  'Green Party': 'green',
  'Green Party of England and Wales': 'green',
  'Scottish Greens': 'green',
  'Plaid Cymru': 'plaid_cymru',
  'Democratic Unionist Party': 'dup',
  'Sinn Féin': 'sinn_fein',
  'Social Democratic & Labour Party': 'sdlp',
  Alliance: 'alliance',
  'Ulster Unionist Party': 'uup',
  'Traditional Unionist Voice': 'tuv',
  Independent: 'independent',
  Speaker: 'speaker',
  // House of Lords groups (fetch-lords-composition.mjs) that aren't
  // political parties: crossbench/bishops get their own party-list entries
  // (build-parties.mjs) since they're sizeable, named groups; non-affiliated
  // peers (and the handful of individually-named one-off cases — the Lord
  // Speaker, a sitting Conservative Independent — folded in with them) reuse
  // the existing Commons "independent" entry rather than adding a near-empty
  // one-off party id for each.
  Crossbench: 'crossbench',
  Bishops: 'bishops',
  'Non-affiliated': 'independent',
  'Lord Speaker': 'independent',
  'Conservative Independent': 'independent',
  // Ballot-paper party names that only ever appear as losing candidates in
  // the results breakdown (fetch-commons-results-breakdown.mjs), mapped
  // onto the same party entries build-scenario.mjs already tracks for
  // polling/finance/membership even though they hold no seats.
  'Workers Party of Britain': 'workers_party',
  'UK Independence Party': 'ukip',
  'Scottish Green Party': 'green',
  'Alba Party': 'alba_party',
  'People Before Profit': 'people_before_profit',
}

function slugifyFallback(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function resolvePartySlug(name, { warnPrefix = '[party-slugs]' } = {}) {
  if (PARTY_SLUGS[name]) return PARTY_SLUGS[name]
  const slug = slugifyFallback(name)
  console.warn(`${warnPrefix} No merge mapping for party "${name}" — using fallback slug "${slug}". Add it to PARTY_SLUGS if this is wrong.`)
  return slug
}
