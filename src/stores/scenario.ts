import { defineStore } from 'pinia'
import type { Topology } from 'topojson-specification'
import type { RegionDemographics, Scenario } from '@/types'
import scenarioData from '@/data/scenarios/uk-2025-01-01/scenario.json'
import boundaries from '@/data/scenarios/uk-2025-01-01/boundaries.commons.json'
import demographicsData from '@/data/scenarios/uk-2025-01-01/demographics.commons.json'

export const useScenarioStore = defineStore('scenario', {
  state: () => ({
    scenario: scenarioData as Scenario,
    boundaries: boundaries as unknown as Topology,
    demographics: demographicsData as RegionDemographics[],
  }),
  getters: {
    party: (state) => (partyId: string) => state.scenario.parties.find((p) => p.id === partyId),
    commonsRegions: (state) => state.scenario.tiers.commons ?? [],
    demographicsByRegion: (state) => {
      const map = new Map<string, RegionDemographics>()
      for (const entry of state.demographics) map.set(entry.regionId, entry)
      return map
    },
  },
})
