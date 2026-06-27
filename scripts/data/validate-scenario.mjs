// Validates a scenario dataset against the invariants from spec §5.2 step 5
// ("seat counts must reconcile to known totals... CI check") and §7.2 (WCAG
// party-card contrast). Run with `npm run validate:data`.
//
// Validates the real dataset (scenario.json + boundaries.commons.json) by
// default; pass --placeholder to validate the placeholder fixtures instead
// (composition.placeholder.json + boundaries.placeholder.json) — both use
// this same validator so a future CI check covers either.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Known seat totals per tier (spec §4.1); only tiers actually present in the
// dataset are checked, so this stays correct as later tiers (Phase 2+) land.
const KNOWN_TIER_SEAT_TOTALS = {
  commons: 650,
  holyrood: 129,
  senedd: 60,
  ni_assembly: 90,
  london_assembly: 25,
  pcc: 37,
}

const MIN_CONTRAST = 4.5

function readJson(relativePath) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf-8'))
}

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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

class ValidationErrors extends Error {
  constructor(errors) {
    super(`${errors.length} validation error(s):\n` + errors.map((e) => `  - ${e}`).join('\n'))
    this.errors = errors
  }
}

// Party master list integrity: every party has the required fields and
// passes WCAG contrast.
function validateParties(scenario) {
  const errors = []
  for (const party of scenario.parties) {
    if (!party.id || !party.name || !party.shortName) {
      errors.push(`party "${party.id ?? '(missing id)'}" is missing a required field (id/name/shortName)`)
    }
    const { primary, onPrimary } = party.colours ?? {}
    if (!primary || !onPrimary) {
      errors.push(`party "${party.id}" is missing colours.primary/onPrimary`)
      continue
    }
    const ratio = contrastRatio(primary, onPrimary)
    if (ratio < MIN_CONTRAST) {
      errors.push(
        `party "${party.id}" colours.onPrimary (${onPrimary}) on primary (${primary}) only reaches ` +
          `${ratio.toFixed(2)}:1 contrast, below the required ${MIN_CONTRAST}:1`,
      )
    }
  }
  return errors
}

// Seat/region/geometry reconciliation for one tier.
function validateTier(tierId, regions, partyIds, boundaryRefs, seenCouncilRegionIds) {
  const errors = []

  const expectedTotal = KNOWN_TIER_SEAT_TOTALS[tierId]
  if (expectedTotal !== undefined) {
    // Total seats, not region count: AMS/STV tiers (holyrood/senedd/
    // ni_assembly/london_assembly) have multiple seats per region, unlike
    // Commons' one-seat-per-region shape.
    const seatTotal = regions.reduce((sum, r) => sum + (r.seats?.length ?? 0), 0)
    if (seatTotal !== expectedTotal) {
      errors.push(`tier "${tierId}" has ${seatTotal} seats across ${regions.length} regions, expected ${expectedTotal}`)
    }
  }

  const seenRegionIds = new Set()

  for (const region of regions) {
    if (!region.id || !region.geometryRef || !region.name) {
      errors.push(`tier "${tierId}": region is missing id/geometryRef/name (id: ${region.id})`)
      continue
    }
    if (seenRegionIds.has(region.id)) errors.push(`tier "${tierId}": duplicate region id "${region.id}"`)
    seenRegionIds.add(region.id)

    if (boundaryRefs && !boundaryRefs.has(region.geometryRef)) {
      errors.push(`tier "${tierId}": region "${region.id}" geometryRef "${region.geometryRef}" has no matching boundary`)
    }

    if (tierId.startsWith('council:')) {
      const previousTier = seenCouncilRegionIds.get(region.id)
      if (previousTier && previousTier !== tierId) {
        errors.push(`council region "${region.id}" appears in both "${previousTier}" and "${tierId}"`)
      }
      seenCouncilRegionIds.set(region.id, tierId)
      if (!region.control?.party || !partyIds.has(region.control.party)) {
        errors.push(`tier "${tierId}": council "${region.id}" has missing/unknown control.party "${region.control?.party}"`)
      }
    }

    if (!region.seats || region.seats.length === 0) {
      errors.push(`tier "${tierId}": region "${region.id}" has no seats`)
      continue
    }
    for (const seat of region.seats) {
      if (!partyIds.has(seat.party)) {
        errors.push(`tier "${tierId}": region "${region.id}" seat references unknown party "${seat.party}"`)
      }
      if (seat.majority !== undefined && (typeof seat.majority !== 'number' || Number.isNaN(seat.majority))) {
        errors.push(`tier "${tierId}": region "${region.id}" seat.majority is not a valid number`)
      }
      if (seat.voteShare !== undefined && (typeof seat.voteShare !== 'number' || Number.isNaN(seat.voteShare))) {
        errors.push(`tier "${tierId}": region "${region.id}" seat.voteShare is not a valid number`)
      }
      if (seat.electedAt !== undefined && !isValidIsoDate(seat.electedAt)) {
        errors.push(`tier "${tierId}": region "${region.id}" seat.electedAt is not a valid ISO date`)
      }
      if (seat.results !== undefined) {
        if (seat.results.length === 0) {
          errors.push(`tier "${tierId}": region "${region.id}" seat.results is present but empty`)
        } else {
          const shareSum = seat.results.reduce((sum, r) => sum + r.voteShare, 0)
          if (Math.abs(shareSum - 100) > 1) {
            errors.push(`tier "${tierId}": region "${region.id}" seat.results vote shares sum to ${shareSum.toFixed(2)}%, expected ~100%`)
          }
          // Not cross-checked against seat.party: seat.party is resolved
          // as-of the scenario date from party-affiliation history (see
          // fetch-commons-composition.mjs), so it correctly diverges from
          // results[0].party (the party the member won the seat as) for
          // anyone who's since defected, lost the whip, or sat as Speaker.
        }
      }
    }
  }

  // Boundaries -> regions: every boundary geometry should be claimed by a region.
  if (boundaryRefs && !tierId.startsWith('council:')) {
    const regionGeometryRefs = new Set(regions.map((r) => r.geometryRef))
    for (const ref of boundaryRefs) {
      if (!regionGeometryRefs.has(ref)) {
        errors.push(`tier "${tierId}": boundary geometryRef "${ref}" has no matching region`)
      }
    }
  }

  return errors
}

// Polling: each entry is a finite number; total should be sensible (<=100).
function validatePolling(scenario, partyIds) {
  const errors = []
  let pollingTotal = 0
  for (const [partyId, pct] of Object.entries(scenario.polling ?? {})) {
    if (!partyIds.has(partyId)) errors.push(`polling references unknown party "${partyId}"`)
    if (typeof pct !== 'number' || Number.isNaN(pct)) errors.push(`polling.${partyId} is not a valid number`)
    else pollingTotal += pct
  }
  if (pollingTotal > 100) errors.push(`polling sums to ${pollingTotal}, expected <= 100`)
  return errors
}

// Finance: every entry is provenance-flagged.
function validateFinances(scenario, partyIds) {
  const errors = []
  for (const [partyId, finance] of Object.entries(scenario.finances ?? {})) {
    if (!partyIds.has(partyId)) errors.push(`finances references unknown party "${partyId}"`)
    if (finance.source !== 'reported' && finance.source !== 'estimated') {
      errors.push(`finances.${partyId}.source must be 'reported' or 'estimated', got "${finance.source}"`)
    }
  }
  return errors
}

// Membership: each entry is a finite, non-negative number.
function validateMembership(scenario, partyIds) {
  const errors = []
  for (const [partyId, count] of Object.entries(scenario.membership ?? {})) {
    if (!partyIds.has(partyId)) errors.push(`membership references unknown party "${partyId}"`)
    if (typeof count !== 'number' || Number.isNaN(count) || count < 0) {
      errors.push(`membership.${partyId} is not a valid non-negative number`)
    }
  }
  return errors
}

function validateCampaignCondition(condition, partyIds, eventActionsById, consequences) {
  const errors = []
  if (!condition || typeof condition.type !== 'string') return ['campaign condition is missing type']
  if ('partyId' in condition && condition.partyId !== 'player' && !partyIds.has(condition.partyId)) {
    errors.push(`campaign condition "${condition.type}" references unknown party "${condition.partyId}"`)
  }
  if ('date' in condition && !isValidIsoDate(condition.date)) {
    errors.push(`campaign condition "${condition.type}" has invalid date "${condition.date}"`)
  }
  if ('value' in condition && (typeof condition.value !== 'number' || Number.isNaN(condition.value))) {
    errors.push(`campaign condition "${condition.type}" has invalid numeric value "${condition.value}"`)
  }
  if (condition.type === 'event-action-taken') {
    const actions = eventActionsById.get(condition.eventId)
    if (!actions) errors.push(`campaign condition references unknown event "${condition.eventId}"`)
    else if (!actions.has(condition.actionId)) errors.push(`campaign condition references unknown action "${condition.eventId}:${condition.actionId}"`)
  }
  if (condition.type === 'arc-consequence' && !consequences.has(condition.consequenceId)) {
    errors.push(`campaign condition references unknown arc consequence "${condition.consequenceId}"`)
  }
  return errors
}

function validateCampaign(scenario, partyIds, events) {
  const errors = []
  const campaign = scenario.campaign
  if (!campaign) return errors
  if (campaign.schemaVersion !== 1) errors.push(`campaign.schemaVersion must be 1, got "${campaign.schemaVersion}"`)
  if (!campaign.briefing?.headline || !campaign.briefing?.summary) errors.push('campaign.briefing requires headline and summary')
  if (!isValidIsoDate(campaign.electoralHorizon?.expectedEndDate)) {
    errors.push(`campaign.electoralHorizon.expectedEndDate is not a valid ISO date: ${campaign.electoralHorizon?.expectedEndDate}`)
  }

  const eventActionsById = new Map()
  for (const event of events) eventActionsById.set(event.id, new Set((event.actions ?? []).map((action) => action.id)))

  const consequenceIds = new Set()
  const arcIds = new Set()
  for (const arc of campaign.arcs ?? []) {
    if (!arc.id || !arc.title || !arc.startsAtStageId) errors.push(`campaign arc is missing id/title/startsAtStageId: ${arc.id}`)
    if (arcIds.has(arc.id)) errors.push(`duplicate campaign arc id "${arc.id}"`)
    arcIds.add(arc.id)
    const stageIds = new Set((arc.stages ?? []).map((stage) => stage.id))
    if (!stageIds.has(arc.startsAtStageId)) errors.push(`campaign arc "${arc.id}" starts at unknown stage "${arc.startsAtStageId}"`)
    for (const stage of arc.stages ?? []) {
      for (const condition of stage.prerequisites ?? []) errors.push(...validateCampaignCondition(condition, partyIds, eventActionsById, consequenceIds))
      for (const branch of stage.branches ?? []) {
        const actions = eventActionsById.get(branch.eventId)
        if (!actions) errors.push(`campaign arc "${arc.id}" branch references unknown event "${branch.eventId}"`)
        else if (!actions.has(branch.actionId)) errors.push(`campaign arc "${arc.id}" branch references unknown action "${branch.eventId}:${branch.actionId}"`)
        if (branch.nextStageId && !stageIds.has(branch.nextStageId)) {
          errors.push(`campaign arc "${arc.id}" branch references unknown nextStageId "${branch.nextStageId}"`)
        }
        if (!branch.consequence?.id || !branch.consequence?.label) {
          errors.push(`campaign arc "${arc.id}" branch is missing consequence id/label`)
        } else if (consequenceIds.has(branch.consequence.id)) {
          errors.push(`duplicate campaign consequence id "${branch.consequence.id}"`)
        } else {
          consequenceIds.add(branch.consequence.id)
        }
      }
    }
  }

  const objectiveIds = new Set()
  for (const objective of [...(campaign.primaryObjectives ?? []), ...(campaign.optionalObjectives ?? [])]) {
    if (!objective.id || !objective.title || !objective.kind) errors.push(`campaign objective is missing id/title/kind: ${objective.id}`)
    if (objectiveIds.has(objective.id)) errors.push(`duplicate campaign objective id "${objective.id}"`)
    objectiveIds.add(objective.id)
    for (const partyId of objective.partyIds ?? []) {
      if (!partyIds.has(partyId)) errors.push(`campaign objective "${objective.id}" references unknown party "${partyId}"`)
    }
    if (objective.activeFrom && !isValidIsoDate(objective.activeFrom)) errors.push(`campaign objective "${objective.id}" activeFrom is invalid`)
    if (objective.expiresOn && !isValidIsoDate(objective.expiresOn)) errors.push(`campaign objective "${objective.id}" expiresOn is invalid`)
    for (const condition of objective.hiddenUntil ?? []) errors.push(...validateCampaignCondition(condition, partyIds, eventActionsById, consequenceIds))
    for (const condition of objective.success ?? []) errors.push(...validateCampaignCondition(condition, partyIds, eventActionsById, consequenceIds))
    for (const condition of objective.failure ?? []) errors.push(...validateCampaignCondition(condition, partyIds, eventActionsById, consequenceIds))
  }

  return errors
}

// Mayoralties (P2.3): no duplicate ids, every party reference resolves,
// every electedAt is a valid ISO date. Not cross-checked against any
// boundary/geometryRef -- mayoralties don't have map geometry in this
// dataset (see src/types/mayoralty.ts).
function validateMayoralties(scenario, partyIds) {
  const errors = []
  if (!scenario.mayoralties) return errors
  const seenMayoraltyIds = new Set()
  for (const mayoralty of scenario.mayoralties) {
    if (!mayoralty.id || !mayoralty.name || !mayoralty.regionRef || !mayoralty.memberName) {
      errors.push(`mayoralty is missing a required field (id/name/regionRef/memberName): ${mayoralty.id}`)
    }
    if (seenMayoraltyIds.has(mayoralty.id)) errors.push(`duplicate mayoralty id "${mayoralty.id}"`)
    seenMayoraltyIds.add(mayoralty.id)
    if (!partyIds.has(mayoralty.party)) {
      errors.push(`mayoralty "${mayoralty.id}" references unknown party "${mayoralty.party}"`)
    }
    if (!isValidIsoDate(mayoralty.electedAt)) {
      errors.push(`mayoralty "${mayoralty.id}" electedAt is not a valid ISO date: ${mayoralty.electedAt}`)
    }
  }
  return errors
}

// Demographics (P1.14): every entry's regionId resolves to a real commons
// region, no duplicates, and source is provenance-flagged.
function validateDemographics(scenario, demographics) {
  const errors = []
  if (!demographics) return errors
  const allRegionIds = new Set(Object.values(scenario.tiers).flatMap((regions) => regions.map((r) => r.id)))
  const seenRegionIds = new Set()
  for (const entry of demographics) {
    if (!allRegionIds.has(entry.regionId)) {
      errors.push(`demographics entry references unknown regionId "${entry.regionId}"`)
    }
    if (seenRegionIds.has(entry.regionId)) errors.push(`demographics: duplicate regionId "${entry.regionId}"`)
    seenRegionIds.add(entry.regionId)
    if (entry.source !== 'official' && entry.source !== 'estimated') {
      errors.push(`demographics.${entry.regionId}.source must be 'official' or 'estimated', got "${entry.source}"`)
    }
  }
  return errors
}

// Orchestrator: add a new check by adding a new validate<Concern> function
// above and calling it here, not by growing an existing one.
function validate(scenario, boundariesByTier, demographics = null, events = []) {
  const errors = []

  if (!isValidIsoDate(scenario.date)) errors.push(`scenario.date is not a valid ISO date: ${scenario.date}`)

  const partyIds = new Set(scenario.parties.map((p) => p.id))

  errors.push(...validateParties(scenario))

  const seenCouncilRegionIds = new Map()
  for (const [tierId, regions] of Object.entries(scenario.tiers)) {
    errors.push(...validateTier(tierId, regions, partyIds, boundariesByTier[tierId], seenCouncilRegionIds))
  }

  errors.push(...validatePolling(scenario, partyIds))
  errors.push(...validateFinances(scenario, partyIds))
  errors.push(...validateMembership(scenario, partyIds))
  errors.push(...validateMayoralties(scenario, partyIds))
  errors.push(...validateDemographics(scenario, demographics))
  errors.push(...validateCampaign(scenario, partyIds, events))

  return errors
}

function boundaryRefsFromTopology(topology, objectKey = 'regions') {
  const object = topology.objects[objectKey]
  if (!object) return null
  return new Set(object.geometries.map((g) => g.properties.geometryRef))
}

function councilWardObjectKey(councilGeometryRef) {
  return `council_wards_${councilGeometryRef.replace(/[^A-Za-z0-9_]/g, '_')}`
}

function validateCouncilWardDrilldown(scenario, wardRegions, wardTopology) {
  const errors = []
  const partyIds = new Set(scenario.parties.map((p) => p.id))
  const councilRegions = Object.entries(scenario.tiers)
    .filter(([tierId]) => tierId.startsWith('council:'))
    .flatMap(([, regions]) => regions)

  const wardsByCouncil = new Map()
  for (const ward of wardRegions) {
    if (!ward.councilGeometryRef) {
      errors.push(`council ward "${ward.id}" is missing councilGeometryRef`)
      continue
    }
    if (!wardsByCouncil.has(ward.councilGeometryRef)) wardsByCouncil.set(ward.councilGeometryRef, [])
    wardsByCouncil.get(ward.councilGeometryRef).push(ward)
    for (const seat of ward.seats ?? []) {
      if (!partyIds.has(seat.party)) {
        errors.push(`council ward "${ward.id}" seat references unknown party "${seat.party}"`)
      }
    }
  }

  for (const council of councilRegions) {
    const objectKey = councilWardObjectKey(council.geometryRef)
    const boundaryRefs = boundaryRefsFromTopology(wardTopology, objectKey)
    if (!boundaryRefs) {
      errors.push(`council "${council.name}" has no ward/division boundary object "${objectKey}"`)
      continue
    }

    const wards = wardsByCouncil.get(council.geometryRef) ?? []
    if (!wards.length) {
      errors.push(`council "${council.name}" has no ward/division composition rows`)
      continue
    }

    for (const ward of wards) {
      if (!boundaryRefs.has(ward.geometryRef)) {
        errors.push(`council "${council.name}" ward "${ward.name}" geometryRef "${ward.geometryRef}" has no boundary`)
      }
    }
  }

  return errors
}

function main() {
  const usePlaceholder = process.argv.includes('--placeholder')

  const scenario = usePlaceholder
    ? readJson('../../src/data/scenarios/uk-2025-01-01/composition.placeholder.json')
    : readJson('../../src/data/scenarios/uk-2025-01-01/scenario.json')

  const boundariesTopology = usePlaceholder
    ? readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.placeholder.json')
    : readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.commons.json')

  const boundariesByTier = { commons: boundaryRefsFromTopology(boundariesTopology, 'regions') }

  if (!usePlaceholder) {
    // NI Assembly's 18 regions map 1:1 onto the 18 Westminster-coincident
    // constituency boundaries, so it gets full boundary cross-checking.
    // Holyrood/Senedd/London Assembly are deliberately omitted here: each has
    // extra multi-seat "region"/"list" composition entries (8/5/1
    // respectively) that have no boundary geometry of their own — see
    // fetch-holyrood-boundaries.mjs's header comment — so a geometryRef
    // cross-check against their boundaries.<tier>.json would always flag
    // those as errors despite being correct by design.
    const niAssemblyTopology = readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.ni_assembly.json')
    boundariesByTier.ni_assembly = boundaryRefsFromTopology(niAssemblyTopology, 'regions')
    const councilTopology = readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.councils.json')
    boundariesByTier['council:county'] = boundaryRefsFromTopology(councilTopology, 'council_county')
    const localBoundaryRefs = boundaryRefsFromTopology(councilTopology, 'council_local')
    boundariesByTier['council:district'] = localBoundaryRefs
    boundariesByTier['council:unitary'] = localBoundaryRefs
    boundariesByTier['council:metropolitan'] = localBoundaryRefs
    boundariesByTier['council:london'] = localBoundaryRefs
    boundariesByTier['council:scottish'] = localBoundaryRefs
    boundariesByTier['council:welsh'] = localBoundaryRefs
    boundariesByTier['council:northern_ireland'] = localBoundaryRefs
  }

  const demographics = usePlaceholder
    ? null
    : readJson('../../src/data/scenarios/uk-2025-01-01/demographics.commons.json')

  const events = usePlaceholder
    ? []
    : [
        ...readJson('../../src/data/scenarios/uk-2025-01-01/events.seed.json'),
        ...readJson('../../src/data/scenarios/uk-2025-01-01/events.scripted.json'),
      ]

  const errors = validate(scenario, boundariesByTier, demographics, events)
  if (!usePlaceholder) {
    errors.push(
      ...validateCouncilWardDrilldown(
        scenario,
        readJson('../../src/data/scenarios/uk-2025-01-01/composition.council_wards.json'),
        readJson('../../src/data/scenarios/uk-2025-01-01/boundaries.council_wards.json'),
      ),
    )
  }

  if (errors.length > 0) {
    console.error(new ValidationErrors(errors).message)
    process.exit(1)
  }

  console.log(
    `OK: ${usePlaceholder ? 'placeholder' : 'real'} dataset "${scenario.id}" passes all validation checks ` +
      `(${Object.values(scenario.tiers).reduce((n, r) => n + r.length, 0)} regions, ${scenario.parties.length} parties).`,
  )
}

main()
