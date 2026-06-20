import { defineStore } from 'pinia'
import type { Topology } from 'topojson-specification'
import type { Scenario } from '@/types'
import scenarioData from '@/data/scenarios/uk-2025-01-01/scenario.json'
import boundaries from '@/data/scenarios/uk-2025-01-01/boundaries.commons.json'

export const useScenarioStore = defineStore('scenario', {
  state: () => ({
    scenario: scenarioData as Scenario,
    boundaries: boundaries as unknown as Topology,
  }),
  getters: {
    party: (state) => (partyId: string) => state.scenario.parties.find((p) => p.id === partyId),
    commonsRegions: (state) => state.scenario.tiers.commons ?? [],
  },
})
