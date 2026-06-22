// Fetches constituency-level reference data (P1.14 step 2) and writes
// src/data/scenarios/uk-2025-01-01/demographics.commons.json, one entry per
// PCON24 code (the same code used as Region.id/geometryRef for the commons
// tier in composition.commons.json/boundaries.commons.json).
//
// Sources actually reachable from this environment (see sources.json for
// full detail and the gaps below):
//   - Population, area, density: ONS ad-hoc "Population density for 2024
//     Westminster Parliamentary Constituencies... mid-2021 to mid-2024"
//     (England & Wales only — Scotland/NI aren't in this release).
//   - Employment/unemployment/economic-inactivity rates: ONS LI02 "Local
//     labour market indicators by 2024 Westminster parliamentary
//     constituency" (Great Britain only — NI isn't covered by the APS).
//
// Deliberately NOT populated this pass (left undefined rather than
// guessed, per spec §4.2's "never present a guess as reported fact"):
//   - medianAge: the only PCON-keyed ONS median-age series found
//     (population estimates: median ages for parliamentary constituency
//     populations) is on the OLD pre-2024 boundaries (pcon11cd) and stops
//     at 2019 — six years stale and the wrong geography, so not worth
//     joining without a boundary-change lookup and an extrapolation
//     neither of which would be a real reported figure.
//   - qualifications (NS-SeC/highest-qualification mix): Census 2021 is
//     published on OA/LSOA/MSOA/LA/ward geographies via Nomis, not PCON24;
//     ONS's "create a custom dataset" tool can re-aggregate Census 2021
//     onto PCON24 but is an interactive SPA, not a stable scriptable API —
//     a future pass should drive it (or its underlying API, once
//     identified) directly rather than scrape the rendered page.
//   - urbanRural: no PCON24-keyed rural/urban classification dataset found.
//   - medianHouseholdIncomeGBP: per spec §4.2, expected to be modelled
//     (source: 'estimated') from regional income x IMD decile — not
//     attempted this pass; needs a product decision on the modelling
//     approach, not just a fetch.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const UA = 'Mozilla/5.0 (compatible; politics-uk data fetch script)'

const POPULATION_DENSITY_URL =
  'https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/populationandmigration/populationestimates/adhocs/3269populationdensityfor2024westminsterparlimentaryconstituenciesinenglandandwalesmid2021tomid2024/foi20263363westminsterparliamentaryconstituenciesmid2021tomid2024.xlsx'
const LI02_EMPLOYMENT_URL =
  'https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/li02regionallabourmarketlocalindicatorsforparliamentaryconstituencies/january2025/lmregtabli02january2025.xlsx'

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Request failed (${res.status} ${res.statusText}): ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

function readWorkbookFromBuffer(buffer) {
  return XLSX.read(buffer, { type: 'buffer' })
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

async function fetchPopulationDensity() {
  const buffer = await fetchBuffer(POPULATION_DENSITY_URL)
  const wb = readWorkbookFromBuffer(buffer)
  const sheet = wb.Sheets['Mid-2022 to mid-2024 PCON']
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  const byRegionId = new Map()
  for (const row of rows) {
    const [code, , areaSqKm, mid2024Population, mid2024Density] = row
    if (!code || typeof code !== 'string' || !/^(E14|W07)/.test(code)) continue
    if (!isFiniteNumber(mid2024Population) || !isFiniteNumber(mid2024Density)) continue
    byRegionId.set(code, {
      population: Math.round(mid2024Population),
      areaSqKm: Math.round(areaSqKm * 100) / 100,
      populationDensityPerKm2: Math.round(mid2024Density * 100) / 100,
    })
  }
  return byRegionId
}

// LI02's January 2025 release left 4 Scottish rows on their pre-2024-review
// GSS code even though the named constituency's boundary didn't change in
// the review (only the code was renumbered as part of the wider Scottish
// PCON24 recode) — confirmed by name against composition.commons.json.
// Remapped onto the PCON24 code boundaries.commons.json/composition use.
const STALE_GSS_CODE_REMAP = {
  S14000008: 'S14000108', // Berwickshire, Roxburgh and Selkirk
  S14000010: 'S14000109', // Central Ayrshire
  S14000040: 'S14000110', // Kilmarnock and Loudoun
  S14000058: 'S14000111', // West Aberdeenshire and Kincardine
}

async function fetchEmploymentIndicators() {
  const buffer = await fetchBuffer(LI02_EMPLOYMENT_URL)
  const wb = readWorkbookFromBuffer(buffer)
  const sheet = wb.Sheets['LI02']
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  const byRegionId = new Map()
  for (const row of rows) {
    const [, rawCode, , , employmentRate, , unemploymentRate, , economicInactivityRate] = row
    if (!rawCode || typeof rawCode !== 'string' || !/^(E14|W07|S14)/.test(rawCode)) continue
    const code = STALE_GSS_CODE_REMAP[rawCode] ?? rawCode
    const entry = {}
    if (isFiniteNumber(employmentRate)) entry.employmentRatePct = Math.round(employmentRate * 10) / 10
    if (isFiniteNumber(unemploymentRate)) entry.unemploymentRatePct = Math.round(unemploymentRate * 10) / 10
    if (isFiniteNumber(economicInactivityRate)) entry.economicInactivityRatePct = Math.round(economicInactivityRate * 10) / 10
    if (Object.keys(entry).length > 0) byRegionId.set(code, entry)
  }
  return byRegionId
}

async function main() {
  console.log('Fetching ONS population density workbook...')
  const density = await fetchPopulationDensity()
  console.log(`Got density/population for ${density.size} regions (England & Wales).`)

  console.log('Fetching ONS LI02 employment workbook...')
  const employment = await fetchEmploymentIndicators()
  console.log(`Got employment indicators for ${employment.size} regions (Great Britain).`)

  const regionIds = new Set([...density.keys(), ...employment.keys()])
  const demographics = [...regionIds]
    .sort()
    .map((regionId) => ({
      regionId,
      ...(density.get(regionId) ?? {}),
      ...(employment.get(regionId) ?? {}),
      source: 'official',
      asOf: 'population/density: mid-2024; employment indicators: Oct 2023-Sep 2024',
    }))

  const outPath = fileURLToPath(new URL('../../src/data/scenarios/uk-2025-01-01/demographics.commons.json', import.meta.url))
  writeFileSync(outPath, JSON.stringify(demographics, null, 2))
  console.log(`Wrote ${outPath} (${demographics.length} regions; no Northern Ireland coverage in either source — see sources.json)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
