import { defineStore } from 'pinia'
import type { Topology } from 'topojson-specification'
import type { PartyId, Region, RegionDemographics, Scenario } from '@/types'
import scenarioData from '@/data/scenarios/uk-2025-01-01/scenario.json'
import boundaries from '@/data/scenarios/uk-2025-01-01/boundaries.commons.json'
import regionalBoundaries from '@/data/scenarios/uk-2025-01-01/boundaries.regional.json'
import demographicsData from '@/data/scenarios/uk-2025-01-01/demographics.commons.json'

const REGIONAL_TIER_IDS = ['holyrood', 'senedd', 'ni_assembly', 'london_assembly'] as const

export const useScenarioStore = defineStore('scenario', {
  state: () => ({
    scenario: scenarioData as Scenario,
    boundaries: boundaries as unknown as Topology,
    regionalBoundaries: regionalBoundaries as unknown as Topology,
    demographics: demographicsData as RegionDemographics[],
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
  },
})
