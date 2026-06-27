import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { Topology } from 'topojson-specification'
import type { PartyId, Region, RegionDemographics, Scenario, TierId } from '@/types'
import scenarioData from '@/data/scenarios/uk-2025-01-01/scenario.json'
import boundaries from '@/data/scenarios/uk-2025-01-01/boundaries.commons.json'
import commonsHexBoundaries from '@/data/scenarios/uk-2025-01-01/boundaries.commons.hex.json'
import regionalBoundaries from '@/data/scenarios/uk-2025-01-01/boundaries.regional.json'
import councilBoundaries from '@/data/scenarios/uk-2025-01-01/boundaries.councils.json'
import councilWardBoundaries from '@/data/scenarios/uk-2025-01-01/boundaries.council_wards.json'
import councilWardComposition from '@/data/scenarios/uk-2025-01-01/composition.council_wards.json'
import demographicsData from '@/data/scenarios/uk-2025-01-01/demographics.commons.json'
import type { HexBoundarySet } from '@/map/MapRenderer'

export const REGIONAL_TIER_IDS = ['holyrood', 'senedd', 'ni_assembly', 'london_assembly'] as const
export const COUNCIL_LEVELS = [
  { id: 'county', tierId: 'council:county', objectKey: 'council_county', label: 'County' },
  { id: 'local', tierId: 'council:local', objectKey: 'council_local', label: 'Local' },
] as const

export type CouncilLevelId = (typeof COUNCIL_LEVELS)[number]['id']

export function councilWardObjectKey(councilGeometryRef: string) {
  return `council_wards_${councilGeometryRef.replace(/[^A-Za-z0-9_]/g, '_')}`
}

const LOCAL_COUNCIL_TIER_IDS = [
  'council:district',
  'council:unitary',
  'council:metropolitan',
  'council:london',
  'council:scottish',
  'council:welsh',
  'council:northern_ireland',
] as const

// P3.4 targeting (spec — the UI needs a human label for any tier it lets a player aim a campaign
// at, beyond the raw `TierId` slug). Falls back to the slug itself for anything not listed here
// rather than guessing a label, so a future tier just shows its id until someone adds one.
const TIER_LABELS: Record<string, string> = {
  commons: 'House of Commons',
  holyrood: 'Holyrood',
  senedd: 'Senedd',
  ni_assembly: 'NI Assembly',
  london_assembly: 'London Assembly',
  'council:county': 'County councils',
  'council:district': 'District councils',
  'council:unitary': 'Unitary councils',
  'council:metropolitan': 'Metropolitan councils',
  'council:london': 'London boroughs',
  'council:scottish': 'Scottish councils',
  'council:welsh': 'Welsh councils',
  'council:northern_ireland': 'Northern Ireland councils',
}

export function tierLabel(tierId: TierId): string {
  return TIER_LABELS[tierId] ?? tierId
}

const councilWardRegionsByCouncil = new Map<string, Region[]>()
for (const region of councilWardComposition as Region[]) {
  if (!region.councilGeometryRef) continue
  const regions = councilWardRegionsByCouncil.get(region.councilGeometryRef) ?? []
  regions.push(region)
  councilWardRegionsByCouncil.set(region.councilGeometryRef, regions)
}

export const useScenarioStore = defineStore('scenario', {
  state: () => ({
    scenario: markRaw(scenarioData) as Scenario,
    boundaries: markRaw(boundaries) as unknown as Topology,
    commonsHexBoundaries: markRaw(commonsHexBoundaries) as HexBoundarySet,
    regionalBoundaries: markRaw(regionalBoundaries) as unknown as Topology,
    councilBoundaries: markRaw(councilBoundaries) as unknown as Topology,
    councilWardBoundaries: markRaw(councilWardBoundaries) as unknown as Topology,
    councilWardRegions: markRaw(councilWardComposition) as Region[],
    demographics: markRaw(demographicsData) as RegionDemographics[],
  }),
  getters: {
    party: (state) => (partyId: string) => state.scenario.parties.find((p) => p.id === partyId),
    commonsRegions: (state) => state.scenario.tiers.commons ?? [],
    // The four Regional-view bodies (P2.1), flattened and keyed by
    // geometryRef so MapView.vue can colour each constituency by its current
    // seat-holder regardless of which of the four tiers it belongs to. Each
    // body's own multi-seat "region"/"list" entries (Holyrood's 8, Senedd's
    // 5, London Assembly's 1) have no boundary geometry — see
    // fetch-holyrood-boundaries.mjs — so they're included here for stats use
    // but simply won't be looked up by any geometryRef in boundaries.regional.json.
    regionalRegionsByGeometryRef: (state) => {
      const map = new Map<string, Region>()
      for (const tierId of REGIONAL_TIER_IDS) {
        for (const region of state.scenario.tiers[tierId] ?? []) {
          map.set(region.geometryRef, region)
        }
      }
      return map
    },
    demographicsByRegion: (state) => {
      const map = new Map<string, RegionDemographics>()
      for (const entry of state.demographics) map.set(entry.regionId, entry)
      return map
    },
    // Mayoralties (P2.3) aren't part of any tier (see src/types/mayoralty.ts
    // for why), so they're counted separately from commonsSeats/otherSeats.
    mayoraltyCountByParty: (state) => {
      const counts: Record<PartyId, number> = {}
      for (const mayoralty of state.scenario.mayoralties) {
        counts[mayoralty.party] = (counts[mayoralty.party] ?? 0) + 1
      }
      return counts
    },
    councilRegionsForLevel: (state) => (levelId: CouncilLevelId) => {
      const level = COUNCIL_LEVELS.find((entry) => entry.id === levelId)
      if (!level) return []
      if (level.id === 'local') {
        return LOCAL_COUNCIL_TIER_IDS.flatMap((tierId) => state.scenario.tiers[tierId] ?? [])
      }
      return state.scenario.tiers[level.tierId] ?? []
    },
    councilControlCountByParty: (state) => {
      const counts: Record<PartyId, number> = {}
      for (const [tierId, regions] of Object.entries(state.scenario.tiers)) {
        if (!tierId.startsWith('council:')) continue
        for (const region of regions) {
          const partyId = region.control?.party
          if (partyId) counts[partyId] = (counts[partyId] ?? 0) + 1
        }
      }
      return counts
    },
    councilWardRegionsForCouncil: () => (councilGeometryRef: string) =>
      councilWardRegionsByCouncil.get(councilGeometryRef) ?? [],
    // P3.4 targeting: a generic id -> Region lookup spanning every tier (including council wards,
    // which live outside `scenario.tiers` — see `councilWardRegions`) so the targeting UI/store can
    // resolve any `TargetScope.regionId` without knowing which tier it came from.
    regionById: (state) => {
      const map = new Map<string, Region>()
      for (const regions of Object.values(state.scenario.tiers)) {
        for (const region of regions) map.set(region.id, region)
      }
      for (const region of state.councilWardRegions) map.set(region.id, region)
      return map
    },
  },
})
