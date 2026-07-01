<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useGameStore } from '@/stores/game'
import { useScenarioStore } from '@/stores/scenario'
import { DATA_VIZ_THEME, formatPercent, trendDelta } from './dataVizTheme'
import PartyMark from './PartyMark.vue'

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
  animationDuration: 220,
  grid: { left: 34, right: 12, top: 12, bottom: 24 },
  tooltip: {
    trigger: 'axis',
    backgroundColor: DATA_VIZ_THEME.tooltipBackground,
    borderColor: DATA_VIZ_THEME.tooltipBorder,
    textStyle: { color: DATA_VIZ_THEME.text, fontSize: 12 },
    valueFormatter: (value: number) => `${formatPercent(value)}%`,
  },
  xAxis: {
    type: 'category',
    data: game.pollingHistory.map((snapshot) => snapshot.date),
    axisLabel: { color: DATA_VIZ_THEME.mutedText, fontSize: 10 },
    axisLine: { lineStyle: { color: DATA_VIZ_THEME.axisLine } },
    axisTick: { lineStyle: { color: DATA_VIZ_THEME.axisLine } },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: DATA_VIZ_THEME.mutedText, fontSize: 10, formatter: '{value}%' },
    axisLine: { lineStyle: { color: DATA_VIZ_THEME.axisLine } },
    splitLine: { lineStyle: { color: DATA_VIZ_THEME.gridLine, type: 'dashed' } },
  },
  series: chartedPartyIds.value.map((partyId) => {
    const party = scenario.party(partyId)
    const isHighlighted = partyId === props.highlightPartyId
    return {
      name: party?.shortName ?? partyId,
      type: 'line',
      showSymbol: isHighlighted,
      symbolSize: isHighlighted ? 5 : 0,
      smooth: 0.25,
      lineStyle: { width: isHighlighted ? 3 : 1.5, color: party?.colours.primary },
      itemStyle: { color: party?.colours.primary },
      emphasis: { focus: 'series' },
      opacity: !props.highlightPartyId || isHighlighted ? 1 : 0.35,
      data: game.pollingHistory.map((snapshot) => snapshot.polling[partyId] ?? null),
    }
  }),
}))

const latestPollingSummary = computed(() => {
  const latest = game.pollingHistory.at(-1)
  const previous = game.pollingHistory.at(-2)
  if (!latest) return []
  return chartedPartyIds.value
    .map((partyId) => ({
      id: partyId,
      party: scenario.party(partyId),
      name: scenario.party(partyId)?.shortName ?? partyId,
      value: latest.polling[partyId] ?? 0,
      colour: scenario.party(partyId)?.colours.primary ?? '#8fa3ad',
      trend: trendDelta(latest.polling[partyId] ?? 0, previous?.polling[partyId]),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
})

const chartSummary = computed(() => {
  if (!latestPollingSummary.value.length) return 'No polling history yet.'
  const leader = latestPollingSummary.value[0]
  return `${leader.name} leads the latest poll at ${formatPercent(leader.value)}%.`
})
</script>

<template>
  <div class="data-viz-panel" :aria-label="chartSummary">
    <div class="h-[160px] w-full" role="img" :aria-label="chartSummary">
      <v-chart :option="chartOption" autoresize />
    </div>
    <div class="mt-2 grid gap-1.5" aria-label="Latest polling table">
      <div
        v-for="party in latestPollingSummary"
        :key="party.id"
        class="data-viz-row"
        :style="{ '--series-colour': party.colour }"
      >
        <PartyMark :party="party.party" :label="party.name" size="xs" decorative />
        <span class="truncate font-semibold text-puk-text">{{ party.name }}</span>
        <span class="tabular-nums text-puk-text">{{ formatPercent(party.value) }}%</span>
        <span class="data-viz-delta" :data-direction="party.trend.direction">{{ party.trend.label }}</span>
      </div>
    </div>
  </div>
</template>
