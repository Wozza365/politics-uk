// Fetches the Commons seat holders as of the scenario's as-of date
// (2025-01-01) from the UK Parliament Members API and writes them as
// Region[] (commons tier) to
// src/data/scenarios/uk-2025-01-01/composition.commons.json, matching the
// shape of src/types/region.ts.
//
// Three calls per member are needed because "current member" search results
// only expose each MP's *latest* party — which can differ from their party
// on the as-of date after a defection/independence/whip suspension (e.g.
// Diane Abbott: Labour on 2025-01-01, Independent again from 2025-07-17).
// We resolve the as-of-date party from each member's full party-affiliation
// history (Biography endpoint) rather than trusting the search result.
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolvePartySlug } from './party-slugs.mjs'
import { normaliseConstituencyName } from './constituency-name.mjs'

const API = 'https://members-api.parliament.uk/api'
const AS_OF_DATE = '2025-01-01'
const CONCURRENCY = 2

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url)
  if (res.status === 429 && attempt <= 12) {
    const retryAfterSec = Number(res.headers.get('retry-after'))
    const wait = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? Math.min(retryAfterSec * 1000, 15000)
      : Math.min(2 ** attempt * 500, 15000)
    await new Promise((resolve) => setTimeout(resolve, wait))
    return fetchJson(url, attempt + 1)
  }
  if (!res.ok) {
    throw new Error(`Request failed (${res.status} ${res.statusText}): ${url}`)
  }
  return res.json()
}

async function fetchAllCurrentMembers() {
  const take = 20
  let skip = 0
  let total = Infinity
  const members = []
  while (skip < total) {
    const params = new URLSearchParams({
      House: '1',
      'MembershipInDateRange.WasMemberOnOrAfter': AS_OF_DATE,
      'MembershipInDateRange.WasMemberOnOrBefore': AS_OF_DATE,
      'MembershipInDateRange.WasMemberOfHouse': '1',
      skip: String(skip),
      take: String(take),
    })
    const page = await fetchJson(`${API}/Members/Search?${params}`)
    total = page.totalResults
    for (const item of page.items) members.push(item.value)
    skip += take
  }
  return members
}

// Find the party affiliation (Commons, house=1) whose date range covers
// AS_OF_DATE; falls back to the member's latest party if no history is found
// (the Biography endpoint omits partyAffiliations for a small number of
// members with a single, ongoing affiliation).
function resolveAsOfDateParty(member, biography) {
  const asOf = new Date(AS_OF_DATE).getTime()
  const affiliations = (biography.partyAffiliations ?? []).filter((a) => a.house === 1)
  for (const a of affiliations) {
    const start = new Date(a.startDate).getTime()
    const end = a.endDate ? new Date(a.endDate).getTime() : Infinity
    if (start <= asOf && asOf <= end) return a.name
  }
  return member.latestParty.name
}

// /Members/{id}/LatestElectionResult always reflects the *current* latest
// result (e.g. a post-2025-01-01 by-election), and 404s once a member has
// left the House. Querying by constituency and picking the most recent
// result on or before AS_OF_DATE is correct for both still-sitting and
// since-departed members. The list endpoint's summary (majority,
// winningParty) is all Seat needs — voteShare is optional (Region.ts) and
// only available via a further per-result call, which isn't worth the extra
// API load against this rate-limited endpoint.
async function fetchAsOfDateElectionResult(constituencyId) {
  const results = await fetchJson(`${API}/Location/Constituency/${constituencyId}/ElectionResults`).then(
    (r) => r.value,
  )
  const asOf = new Date(AS_OF_DATE).getTime()
  const eligible = results.filter((r) => new Date(r.electionDate).getTime() <= asOf)
  if (eligible.length === 0) {
    throw new Error(`No election result on or before ${AS_OF_DATE} for constituency ${constituencyId}`)
  }
  return eligible.reduce((latest, r) => (new Date(r.electionDate) > new Date(latest.electionDate) ? r : latest))
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length)
  let next = 0
  async function runner() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, runner))
  return results
}

async function main() {
  const boundariesPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.commons.json', import.meta.url),
  )
  const boundaries = JSON.parse(readFileSync(boundariesPath, 'utf-8'))
  const nameToGeometryRef = new Map(
    boundaries.objects.regions.geometries.map((g) => [
      normaliseConstituencyName(g.properties.name),
      g.properties.geometryRef,
    ]),
  )

  console.log('Fetching current Commons members as of', AS_OF_DATE, '...')
  const members = await fetchAllCurrentMembers()
  console.log(`Found ${members.length} members.`)

  const regions = await runPool(
    members,
    async (member) => {
      const [biography, electionResult] = await Promise.all([
        fetchJson(`${API}/Members/${member.id}/Biography`).then((r) => r.value),
        fetchAsOfDateElectionResult(member.latestHouseMembership.membershipFromId),
      ])

      const partyName = resolveAsOfDateParty(member, biography)
      const party = resolvePartySlug(partyName)

      const constituencyName = member.latestHouseMembership.membershipFrom
      const geometryRef = nameToGeometryRef.get(normaliseConstituencyName(constituencyName))
      if (!geometryRef) {
        console.warn(`[fetch-commons-composition] No boundary match for constituency "${constituencyName}" (member ${member.id} ${member.nameDisplayAs})`)
      }

      return {
        id: geometryRef ?? constituencyName,
        tier: 'commons',
        name: constituencyName,
        geometryRef: geometryRef ?? constituencyName,
        seats: [
          {
            regionId: geometryRef ?? constituencyName,
            party,
            memberName: member.nameDisplayAs,
            majority: electionResult.majority,
            electedAt: electionResult.electionDate.slice(0, 10),
          },
        ],
      }
    },
    CONCURRENCY,
  )

  regions.sort((a, b) => a.id.localeCompare(b.id))

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.commons.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify(regions, null, 2))
  console.log(`Wrote ${outPath} (${regions.length} regions)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
