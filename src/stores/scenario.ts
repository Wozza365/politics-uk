import { defineStore } from 'pinia'
import type { Topology } from 'topojson-specification'
import type { Scenario } from '@/types'
import compositionPlaceholder from '@/data/scenarios/uk-2025-01-01/composition.placeholder.json'
import boundariesPlaceholder from '@/data/scenarios/uk-2025-01-01/boundaries.placeholder.json'

export const useScenarioStore = defineStore('scenario', {
  state: () => ({
    scenario: compositionPlaceholder as Scenario,
    boundaries: boundariesPlaceholder as unknown as Topology,
  }),
  getters: {
    party: (state) => (partyId: string) => state.scenario.parties.find((p) => p.id === partyId),
    commonsRegions: (state) => state.scenario.tiers.commons ?? [],
  },
})
