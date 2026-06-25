// Builds P2.4 council composition data from Open Council Data UK's public
// archive. The scenario date is 2025-01-01, so this intentionally uses the
// 2024 archive: Open Council Data's yearly CSVs are snapshots from shortly
// after each May election, making 2024 the closest archive before the
// scenario starts.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import proj4 from 'proj4'
import { topology } from 'topojson-server'
import { resolvePartySlug } from './party-slugs.mjs'

const ARCHIVE_YEAR = 2024
const BASE_URL = 'https://opencouncildata.co.uk'

const COUNCIL_LEVELS = [
  { id: 'county', label: 'County councils', model: 'C', url: `${BASE_URL}/councils.php?model=C&y=${ARCHIVE_YEAR}` },
  { id: 'district', label: 'District / borough councils', model: 'D', url: `${BASE_URL}/councils.php?model=D&y=${ARCHIVE_YEAR}` },
  { id: 'unitary', label: 'Unitary authorities', model: 'U', url: `${BASE_URL}/councils.php?model=U&y=${ARCHIVE_YEAR}` },
  { id: 'metropolitan', label: 'Metropolitan boroughs', model: 'M', url: `${BASE_URL}/councils.php?model=M&y=${ARCHIVE_YEAR}` },
  { id: 'london', label: 'London boroughs', model: 'L', url: `${BASE_URL}/councils.php?model=L&y=${ARCHIVE_YEAR}` },
  { id: 'scottish', label: 'Scottish councils', model: 'S', url: `${BASE_URL}/councils.php?model=S&y=${ARCHIVE_YEAR}` },
  { id: 'welsh', label: 'Welsh councils', model: 'W', url: `${BASE_URL}/councils.php?model=W&y=${ARCHIVE_YEAR}` },
  { id: 'northern_ireland', label: 'NI councils', model: 'NI', url: `${BASE_URL}/nicouncils.php?y=${ARCHIVE_YEAR}` },
]

const PARTY_NAME_OVERRIDES = {
  'Conservative and Unionist': 'Conservative',
  'Labour Party': 'Labour',
  'Liberal Democrats': 'Liberal Democrat',
  'Green Party (E&W)': 'Green Party',
  'Green Party (NI)': 'Green Party',
  'Scottish Green Party': 'Green Party',
  'Scottish National Party (SNP)': 'Scottish National Party',
  'Plaid Cymru - The Party of Wales': 'Plaid Cymru',
  'Democratic Unionist Party - D.U.P.': 'Democratic Unionist Party',
  'Sinn Féin': 'Sinn Féin',
  'SDLP (Social Democratic & Labour Party)': 'Social Democratic & Labour Party',
  'Alliance - Alliance Party of Northern Ireland': 'Alliance',
  'Traditional Unionist Voice - TUV': 'Traditional Unionist Voice',
  'People Before Profit Alliance': 'People Before Profit',
  'Independent / Other': 'Independent',
  Vacant: 'Independent',
}

const CONTROL_TO_PARTY = {
  LAB: 'labour',
  LABOUR: 'labour',
  CON: 'conservative',
  CONSERVATIVE: 'conservative',
  LD: 'liberal_democrat',
  LDM: 'liberal_democrat',
  LIBERAL: 'liberal_democrat',
  GRN: 'green',
  GREEN: 'green',
  REF: 'reform_uk',
  RFM: 'reform_uk',
  SNP: 'snp',
  PC: 'plaid_cymru',
  PLAID: 'plaid_cymru',
  DUP: 'dup',
  SF: 'sinn_fein',
  SDLP: 'sdlp',
  APNI: 'alliance',
  UUP: 'uup',
  TUV: 'tuv',
  IND: 'independent',
}

const COUNCILLOR_CSV_URL = `${BASE_URL}/csv2.php?y=${ARCHIVE_YEAR}`
const GB_HISTORY_CSV_URL = `${BASE_URL}/history2016-26.csv`
const LAD_BOUNDARIES_URL =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_December_2024_Boundaries_UK_BGC/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson&returnGeometry=true'
const COUNTY_UNITARY_BOUNDARIES_URL =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Counties_and_Unitary_Authorities_December_2024_Boundaries_UK_BGC/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson&returnGeometry=true'
const WARD_BOUNDARIES_URL =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Wards_December_2024_Boundaries_UK_BGC/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson&returnGeometry=true'
const COUNTY_DIVISION_BOUNDARIES_URL =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/CED_MAY_2024_EN_BGC_V3/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson'
const NI_DISTRICT_ELECTORAL_AREAS_URL =
  'https://admin.opendatani.gov.uk/dataset/02e0efc8-fa81-4b90-9213-a3da5934db0d/resource/fa6e390a-9150-4b47-8a8a-a78a9603914d/download/osni_open_data_largescale_boundaries_district_electoral_areas_2012.geojson'

proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs',
)

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return res.text()
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return res.json()
}

async function fetchFeatureCollection(url, label, attempts = 10) {
  if (url.includes('/query?')) return fetchArcgisFeatureCollection(url, label)

  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const json = await fetchJson(url)
      if (json?.type === 'FeatureCollection' && Array.isArray(json.features)) return json
      if (json?.status === 'Pending') {
        throw new Error(`${label} download is still being generated`)
      }
      throw new Error(`${label} response was not a GeoJSON FeatureCollection`)
    } catch (error) {
      lastError = error
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
    }
  }
  throw lastError
}

async function fetchArcgisFeatureCollection(url, label, pageSize = 2000) {
  const features = []
  let template = null

  for (let offset = 0; offset < pageSize * 100; offset += pageSize) {
    const separator = url.includes('?') ? '&' : '?'
    const pageUrl = `${url}${separator}resultOffset=${offset}&resultRecordCount=${pageSize}`
    const json = await fetchJson(pageUrl)
    if (json?.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
      throw new Error(`${label} response was not a GeoJSON FeatureCollection`)
    }
    template ??= json
    features.push(...json.features)
    if (!json.properties?.exceededTransferLimit && json.features.length < pageSize) {
      return { ...template, features, properties: { ...template.properties, exceededTransferLimit: false } }
    }
  }

  throw new Error(`${label} exceeded the ArcGIS pagination limit`)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }

  const headers = rows.shift()
  return rows
    .filter((cells) => cells.length === headers.length)
    .map((cells) => Object.fromEntries(headers.map((header, i) => [header, cells[i]])))
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normaliseName(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(city|county|district|borough|council|royal|the|of)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
}

function wardObjectKey(councilGeometryRef) {
  return `council_wards_${councilGeometryRef.replace(/[^A-Za-z0-9_]/g, '_')}`
}

function normaliseWardName(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(ed|ward|electoral division|division)\b/g, ' ')
    .replace(/\bst\b/g, 'saint')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
}

function normalisedWardNameForCouncil(councilGeometryRef, wardName) {
  const key = normaliseWardName(wardName)
  const aliases = {
    E07000215: {
      lingfieldcrowhurstandtandridge: 'lingfieldandcrowhurst',
    },
    E09000001: {
      bridgeandbridgewithout: 'bridge',
    },
  }
  return aliases[councilGeometryRef]?.[key] ?? key
}

function pointInRing(point, ring) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(point, polygon) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false
  return !polygon.slice(1).some((hole) => pointInRing(point, hole))
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates)
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon))
  return false
}

function transformCoordinatesToBng(coordinates) {
  if (typeof coordinates[0] === 'number') return proj4('EPSG:4326', 'EPSG:27700', coordinates)
  return coordinates.map(transformCoordinatesToBng)
}

function firstCoordinate(coordinates) {
  if (!Array.isArray(coordinates)) return null
  if (typeof coordinates[0] === 'number') return coordinates
  for (const child of coordinates) {
    const coord = firstCoordinate(child)
    if (coord) return coord
  }
  return null
}

function featureCollectionUsesLonLat(featureCollection) {
  for (const feature of featureCollection.features) {
    if (!feature.geometry) continue
    const coord = firstCoordinate(feature.geometry.coordinates)
    if (!coord) continue
    return Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90
  }
  return false
}

function transformFeatureCollectionToBng(featureCollection) {
  return {
    ...featureCollection,
    features: featureCollection.features.map((feature) => ({
      ...feature,
      geometry: feature.geometry
        ? {
            ...feature.geometry,
            coordinates: transformCoordinatesToBng(feature.geometry.coordinates),
          }
        : feature.geometry,
    })),
  }
}

function ensureFeatureCollectionBng(featureCollection) {
  return featureCollectionUsesLonLat(featureCollection) ? transformFeatureCollectionToBng(featureCollection) : featureCollection
}

function boundaryLookup(features, nameField) {
  const map = new Map()
  for (const feature of features) {
    const name = feature.properties[nameField]
    map.set(normaliseName(name), feature)
  }
  return map
}

function findBoundaryFeature(councilName, lookup) {
  const direct = lookup.get(normaliseName(councilName))
  if (direct) return direct

  const aliases = {
    'Bath and North East Somerset': 'Bath and North East Somerset',
    'Bournemouth, Christchurch and Poole': 'Bournemouth, Christchurch and Poole',
    Bristol: 'Bristol, City of',
    Edinburgh: 'City of Edinburgh',
    'Herefordshire': 'County of Herefordshire',
    'Kingston upon Hull': 'Kingston upon Hull, City of',
    'Folkestone and Hythe': 'Folkestone and Hythe',
    'Derry City and Strabane': 'Derry City and Strabane',
  }
  return aliases[councilName] ? lookup.get(normaliseName(aliases[councilName])) : undefined
}

function partyForCouncilSeat(partyName) {
  const canonical = PARTY_NAME_OVERRIDES[partyName] ?? partyName
  if (canonical !== partyName || ['Alba Party', 'Aspire', 'People Before Profit', 'Workers Party of Britain'].includes(partyName)) {
    return resolvePartySlug(canonical, { warnPrefix: '[fetch-councils]' })
  }
  return 'independent'
}

function partyForControl(control) {
  const firstToken = control
    .replace(/\bmin\b/gi, '')
    .split(/[ /-]+/)
    .find(Boolean)
    ?.replace(/[^a-z]/gi, '')
    .toUpperCase()
  return CONTROL_TO_PARTY[firstToken] ?? 'independent'
}

function extractAuthorityTypes(htmlByLevel) {
  const byCouncilName = new Map()
  for (const level of COUNCIL_LEVELS) {
    const html = htmlByLevel[level.id]
    const matches = html.matchAll(/council\.php\?c=(\d+)&y=\d+">([^<]+)<\/a>/g)
    for (const match of matches) {
      const name = match[2].replace(/&amp;/g, '&')
      byCouncilName.set(name, { levelId: level.id, councilId: match[1] })
    }
  }
  return byCouncilName
}

function extractControls(htmlByLevel) {
  const controls = new Map()
  const rowPattern = /<tr><td[^>]*>[^<]*<\/td><td[^>]*><a href="council\.php\?c=\d+&y=\d+">([^<]+)<\/a><\/td><td[^>]*>([^<]+)<\/td>/g
  for (const html of Object.values(htmlByLevel)) {
    for (const match of html.matchAll(rowPattern)) {
      controls.set(match[1].replace(/&amp;/g, '&'), match[2].trim())
    }
  }
  return controls
}

function buildCouncilBoundaries(regionsByLevel, ladGeojson, countyUnitaryGeojson) {
  const countyRepresentedRefs = new Set((regionsByLevel.county ?? []).map((region) => region.geometryRef))
  const localRepresentedRefs = new Set(
    COUNCIL_LEVELS.filter((level) => level.id !== 'county').flatMap((level) =>
      (regionsByLevel[level.id] ?? []).map((region) => region.geometryRef),
    ),
  )

  const objects = {
    council_county: {
      type: 'FeatureCollection',
      features: countyUnitaryGeojson.features.map((feature) => ({
        type: 'Feature',
        properties: {
          geometryRef: feature.properties.CTYUA24CD,
          name: feature.properties.CTYUA24NM,
          represented: countyRepresentedRefs.has(feature.properties.CTYUA24CD),
        },
        geometry: feature.geometry,
      })),
    },
    council_local: {
      type: 'FeatureCollection',
      features: ladGeojson.features.map((feature) => ({
        type: 'Feature',
        properties: {
          geometryRef: feature.properties.LAD24CD,
          name: feature.properties.LAD24NM,
          represented: localRepresentedRefs.has(feature.properties.LAD24CD),
        },
        geometry: feature.geometry,
      })),
    },
  }

  return topology(objects)
}

function partyWithMostSeats(seats) {
  const counts = new Map()
  for (const seat of seats) counts.set(seat.party, (counts.get(seat.party) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'independent'
}

function featureCollectionForCouncil(council, sourceFeatures, codeField, nameField, rowsByWardName, geometryRefsUsed) {
  const features = []
  const wardRegions = []
  const matchedWardNames = new Set()

  for (const feature of sourceFeatures) {
    const wardName = feature.properties[nameField]
    const seats = rowsByWardName.get(normaliseWardName(wardName))
    if (!seats?.length) continue
    const geometryRef = feature.properties[codeField]
    matchedWardNames.add(normaliseWardName(wardName))
    geometryRefsUsed.add(geometryRef)

    features.push({
      type: 'Feature',
      properties: {
        geometryRef,
        councilGeometryRef: council.geometryRef,
        name: wardName,
      },
      geometry: feature.geometry,
    })
    wardRegions.push({
      id: geometryRef,
      tier: `${council.tier}:wards`,
      name: wardName,
      geometryRef,
      councilGeometryRef: council.geometryRef,
      councilName: council.name,
      control: {
        label: scenarioPartyLabel(partyWithMostSeats(seats)),
        party: partyWithMostSeats(seats),
        source: 'Open Council Data UK ward councillor rows',
        asOf: `shortly after May ${ARCHIVE_YEAR} elections`,
      },
      seats: seats.map((seat) => ({ ...seat, regionId: geometryRef })),
    })
  }

  const missingWardNames = [...rowsByWardName.keys()].filter((wardName) => !matchedWardNames.has(wardName))
  return { features, wardRegions, missingWardNames }
}

function scenarioPartyLabel(partyId) {
  return partyId
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildCouncilWardBoundaries(allRegions, wardGeojson, countyDivisionGeojson, niDeaGeojson, countyUnitaryGeojson) {
  const objects = {}
  const wardComposition = []
  const missing = []
  const geometryRefsUsed = new Set()
  const countyBoundariesByRef = new Map(
    countyUnitaryGeojson.features.map((feature) => [feature.properties.CTYUA24CD, feature]),
  )

  for (const council of allRegions) {
    const rowsByWardName = new Map()
    for (const seat of council.seats) {
      const key = normalisedWardNameForCouncil(council.geometryRef, seat.wardName ?? '')
      if (!key) continue
      if (!rowsByWardName.has(key)) rowsByWardName.set(key, [])
      rowsByWardName.get(key).push(seat)
    }

    const sourceFeatures =
      council.tier === 'council:county'
        ? countyDivisionGeojson.features.filter((feature) => {
            const point = [feature.properties.BNG_E, feature.properties.BNG_N]
            return pointInGeometry(point, countyBoundariesByRef.get(council.geometryRef)?.geometry)
          })
        : council.tier === 'council:northern_ireland'
          ? niDeaGeojson.features.map((feature) => ({
              ...feature,
              properties: {
                ...feature.properties,
                DEA24CD: `NI_DEA_${feature.properties.OBJECTID}`,
                DEA24NM: feature.properties.FinalR_DEA,
              },
            }))
        : wardGeojson.features.filter((feature) => feature.properties.LAD24CD === council.geometryRef)

    const result = featureCollectionForCouncil(
      council,
      sourceFeatures,
      council.tier === 'council:county' ? 'CED24CD' : council.tier === 'council:northern_ireland' ? 'DEA24CD' : 'WD24CD',
      council.tier === 'council:county' ? 'CED24NM' : council.tier === 'council:northern_ireland' ? 'DEA24NM' : 'WD24NM',
      rowsByWardName,
      geometryRefsUsed,
    )

    if (result.missingWardNames.length) {
      missing.push(`${council.name}: ${result.missingWardNames.length} missing (${result.missingWardNames.slice(0, 5).join(', ')})`)
    }

    objects[wardObjectKey(council.geometryRef)] = {
      type: 'FeatureCollection',
      features: result.features,
    }
    wardComposition.push(...result.wardRegions)
  }

  if (missing.length) {
    throw new Error(
      `Could not match ${missing.length} councils' ward/division names to ONS ward geometry:\n` +
        missing.slice(0, 80).map((line) => `  - ${line}`).join('\n'),
    )
  }

  return { boundaries: topology(objects), composition: wardComposition }
}

async function main() {
  const [councillorCsv, historyCsv, ladGeojson, countyUnitaryGeojson, wardGeojson, countyDivisionGeojson, niDeaGeojsonRaw, ...levelHtml] = await Promise.all([
    fetchText(COUNCILLOR_CSV_URL),
    fetchText(GB_HISTORY_CSV_URL),
    fetchFeatureCollection(LAD_BOUNDARIES_URL, 'LAD boundaries'),
    fetchFeatureCollection(COUNTY_UNITARY_BOUNDARIES_URL, 'county/unitary boundaries'),
    fetchFeatureCollection(WARD_BOUNDARIES_URL, 'ward boundaries'),
    fetchFeatureCollection(COUNTY_DIVISION_BOUNDARIES_URL, 'county electoral division boundaries'),
    fetchFeatureCollection(NI_DISTRICT_ELECTORAL_AREAS_URL, 'Northern Ireland district electoral area boundaries'),
    ...COUNCIL_LEVELS.map((level) => fetchText(level.url)),
  ])
  const ladBoundariesGeojson = ensureFeatureCollectionBng(ladGeojson)
  const countyUnitaryBoundariesGeojson = ensureFeatureCollectionBng(countyUnitaryGeojson)
  const wardBoundariesGeojson = ensureFeatureCollectionBng(wardGeojson)
  const countyDivisionBoundariesGeojson = ensureFeatureCollectionBng(countyDivisionGeojson)
  const niDeaGeojson = ensureFeatureCollectionBng(niDeaGeojsonRaw)

  const htmlByLevel = Object.fromEntries(COUNCIL_LEVELS.map((level, i) => [level.id, levelHtml[i]]))
  const authorityTypes = extractAuthorityTypes(htmlByLevel)
  const ladBoundaries = boundaryLookup(ladBoundariesGeojson.features, 'LAD24NM')
  const countyUnitaryBoundaries = boundaryLookup(countyUnitaryBoundariesGeojson.features, 'CTYUA24NM')
  const controlsFromPages = extractControls(htmlByLevel)
  const historyControls = new Map(
    parseCsv(historyCsv)
      .filter((row) => Number(row.year) === ARCHIVE_YEAR)
      .map((row) => [row.authority, row.majority]),
  )

  const rowsByCouncil = new Map()
  for (const row of parseCsv(councillorCsv)) {
    const council = row.Council
    if (!authorityTypes.has(council)) continue
    if (!rowsByCouncil.has(council)) rowsByCouncil.set(council, [])
    rowsByCouncil.get(council).push(row)
  }

  const regionsByLevel = Object.fromEntries(COUNCIL_LEVELS.map((level) => [level.id, []]))
  const missingBoundaryMatches = []

  for (const [councilName, rows] of [...rowsByCouncil].sort(([a], [b]) => a.localeCompare(b))) {
    const authority = authorityTypes.get(councilName)
    const boundary = findBoundaryFeature(
      councilName,
      authority.levelId === 'county' ? countyUnitaryBoundaries : ladBoundaries,
    )
    if (!boundary) {
      missingBoundaryMatches.push(`${councilName} (${authority.levelId})`)
      continue
    }
    const geometryRef = authority.levelId === 'county' ? boundary.properties.CTYUA24CD : boundary.properties.LAD24CD
    const tier = `council:${authority.levelId}`
    const id = `ocd-${authority.councilId}`
    const controlLabel = controlsFromPages.get(councilName) ?? historyControls.get(councilName) ?? 'Unknown'
    const controlParty = partyForControl(controlLabel)

    const seats = rows.map((row, index) => ({
      regionId: id,
      party: partyForCouncilSeat(row['Party Name']),
      memberName: row['Councillor Name'] || undefined,
      electedAt: '2024-05-02',
      wardName: row['Ward Name'] || undefined,
      nextElection: row['Next Election'] || undefined,
      seatType: 'councillor',
    }))

    regionsByLevel[authority.levelId].push({
      id,
      tier,
      name: councilName,
      geometryRef,
      control: {
        label: controlLabel,
        party: controlParty,
        source: 'Open Council Data UK',
        asOf: `shortly after May ${ARCHIVE_YEAR} elections`,
      },
      seats,
    })
  }

  if (missingBoundaryMatches.length) {
    throw new Error(
      `Could not match ${missingBoundaryMatches.length} councils to ONS boundaries:\n` +
        missingBoundaryMatches.map((name) => `  - ${name}`).join('\n'),
    )
  }

  const allRegions = Object.values(regionsByLevel).flat()
  const boundaries = buildCouncilBoundaries(regionsByLevel, ladBoundariesGeojson, countyUnitaryBoundariesGeojson)
  const wardData = buildCouncilWardBoundaries(
    allRegions,
    wardBoundariesGeojson,
    countyDivisionBoundariesGeojson,
    niDeaGeojson,
    countyUnitaryBoundariesGeojson,
  )

  const compositionPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.councils.json', import.meta.url),
  )
  writeFileSync(compositionPath, JSON.stringify(allRegions, null, 2))

  const wardCompositionPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.council_wards.json', import.meta.url),
  )
  writeFileSync(wardCompositionPath, JSON.stringify(wardData.composition, null, 2))

  const boundariesPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.councils.json', import.meta.url),
  )
  writeFileSync(boundariesPath, JSON.stringify(boundaries, null, 2))

  const wardBoundariesPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/boundaries.council_wards.json', import.meta.url),
  )
  writeFileSync(wardBoundariesPath, JSON.stringify(wardData.boundaries, null, 2))

  console.log(`Built ${allRegions.length} councils, ${allRegions.reduce((sum, r) => sum + r.seats.length, 0)} councillor seats.`)
  console.log(`Built ${wardData.composition.length} ward/division regions.`)
  console.log(`Wrote ${compositionPath}`)
  console.log(`Wrote ${wardCompositionPath}`)
  console.log(`Wrote ${boundariesPath}`)
  console.log(`Wrote ${wardBoundariesPath}`)
}

main()
