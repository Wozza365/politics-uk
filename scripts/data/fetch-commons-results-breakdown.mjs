// Fetches the full previous-election candidate-level vote-share breakdown
// (every candidate, not just the winner), plus turnout and electorate, for
// every Commons constituency, and merges it into the existing seat objects
// in src/data/scenarios/uk-2025-01-01/composition.commons.json (P1.14 step 1).
//
// fetch-commons-composition.mjs (P0.3.2) deliberately omitted this: the
// per-constituency Members API list endpoint only returns the winner's
// majority, and a full breakdown needs one further call per constituency,
// which rate-limited that script's development runs. This script makes
// that extra call but reuses the same exponential-backoff retry on 429
// already proven out there, run at low concurrency.
//
// The Commons Library's CBP-10009 candidate-level CSV (a single download
// covering all 650 seats, no per-seat API calls) was evaluated as a
// rate-limit-free alternative but its host
// (researchbriefings.files.parliament.uk) sits behind a Cloudflare managed
// JS challenge that a plain HTTP client cannot pass — the Members API path
// below is what actually works from this environment.
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

async function fetchAllConstituencies() {
  const take = 20
  let skip = 0
  let total = Infinity
  const constituencies = []
  while (skip < total) {
    const params = new URLSearchParams({ skip: String(skip), take: String(take) })
    const page = await fetchJson(`${API}/Location/Constituency/Search?${params}`)
    total = page.totalResults
    for (const item of page.items) constituencies.push({ id: item.value.id, name: item.value.name })
    skip += take
  }
  return constituencies
}

// Same selection rule as fetch-commons-composition.mjs: the most recent
// election result on or before AS_OF_DATE, so a constituency that's had a
// by-election since the 2024 GE still resolves to the right one.
async function fetchAsOfDateElectionResult(constituencyId) {
  const results = await fetchJson(`${API}/Location/Constituency/${constituencyId}/ElectionResults`).then((r) => r.value)
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

function readJson(relativePath) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf-8'))
}

async function main() {
  const composition = readJson('../../src/data/scenarios/uk-2025-01-01/composition.commons.json')
  const byNormalisedName = new Map(composition.map((region) => [normaliseConstituencyName(region.name), region]))

  console.log('Fetching constituency list...')
  const constituencies = await fetchAllConstituencies()
  console.log(`Found ${constituencies.length} constituencies.`)

  let matched = 0
  let failed = 0

  await runPool(
    constituencies,
    async (constituency) => {
      const region = byNormalisedName.get(normaliseConstituencyName(constituency.name))
      if (!region) {
        console.warn(`[fetch-commons-results-breakdown] No composition region match for constituency "${constituency.name}" (id ${constituency.id})`)
        return
      }

      try {
        const summary = await fetchAsOfDateElectionResult(constituency.id)
        const detail = await fetchJson(`${API}/Location/Constituency/${constituency.id}/ElectionResult/${summary.electionId}`).then((r) => r.value)

        const results = [...detail.candidates]
          .sort((a, b) => a.rankOrder - b.rankOrder)
          .map((c) => ({
            party: resolvePartySlug(c.party.name, { warnPrefix: '[fetch-commons-results-breakdown]' }),
            candidateName: c.name,
            votes: c.votes,
            voteShare: Math.round(c.voteShare * 1000 * 100) / 1000, // fraction -> %, 3dp
          }))

        const seat = region.seats[0]
        seat.turnout = summary.turnout
        seat.electorate = summary.electorate
        seat.results = results
        if (results.length > 0) seat.voteShare = results[0].voteShare

        matched += 1
      } catch (err) {
        failed += 1
        console.error(`[fetch-commons-results-breakdown] Failed for "${constituency.name}" (id ${constituency.id}): ${err.message}`)
      }
    },
    CONCURRENCY,
  )

  console.log(`Matched and updated ${matched} regions; ${failed} failed.`)

  const outPath = fileURLToPath(new URL('../../src/data/scenarios/uk-2025-01-01/composition.commons.json', import.meta.url))
  writeFileSync(outPath, JSON.stringify(composition, null, 2))
  console.log(`Wrote ${outPath}`)

  if (failed > 0) {
    console.error(`${failed} constituencies failed — re-run this script to retry (it overwrites in place and is safe to re-run).`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
