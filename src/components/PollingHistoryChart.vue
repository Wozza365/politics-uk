<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{ highlightPartyId?: string | null }>()

const game = useGameStore()
const scenario = useScenarioStore()

// Only parties that ever register in the polling history, in scenario order, so a long tail of
// fringe parties with no data doesn't add empty legend/series entries.
const chartedPartyIds = computed(() =>
  scenario.scenario.parties
    .map((party) => party.id)
    .filter((id) => game.pollingHistory.some((snapshot) => (snapshot.polling[id] ?? 0) > 0)),
)

const chartOption = computed(() => ({
  backgroundColor: 'transparent',
  grid: { left: 32, right: 8, top: 8, bottom: 20 },
  tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value.toFixed(1)}%` },
  xAxis: {
    type: 'category',
    data: game.pollingHistory.map((snapshot) => snapshot.date),
    axisLabel: { color: '#a1a1aa', fontSize: 10 },
    axisLine: { lineStyle: { color: '#3f3f46' } },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#a1a1aa', fontSize: 10, formatter: '{value}%' },
    splitLine: { lineStyle: { color: '#27272a' } },
  },
  series: chartedPartyIds.value.map((partyId) => {
    const party = scenario.party(partyId)
    const isHighlighted = partyId === props.highlightPartyId
    return {
      name: party?.shortName ?? partyId,
      type: 'line',
      showSymbol: false,
      lineStyle: { width: isHighlighted ? 3 : 1, color: party?.colours.primary },
      itemStyle: { color: party?.colours.primary },
      opacity: !props.highlightPartyId || isHighlighted ? 1 : 0.35,
      data: game.pollingHistory.map((snapshot) => snapshot.polling[partyId] ?? null),
    }
  }),
}))
</script>

<template>
  <div class="h-[160px] w-full">
    <v-chart :option="chartOption" autoresize />
  </div>
</template>
