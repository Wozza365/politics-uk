<script setup lang="ts">
// Pure presentational 2D political-compass plane (spec §4.4). Reused compact
// (party card overall-compass circle) and full (party panel, later P1.7).
// No game logic or store access in here — everything comes in via props.
import { computed } from 'vue'
import type { CompassPosition } from '@/types'
import { compassToCoords, radiusFromConsistency } from './compassMath'

export interface CompassItem {
  position: CompassPosition
  consistency: number
  colour: string
  label?: string
}

const props = defineProps<{
  items: CompassItem[]
  compact?: boolean
}>()

const size = computed(() => (props.compact ? 48 : 240))
const maxRadius = computed(() => (props.compact ? 18 : 48))
const minRadius = computed(() => (props.compact ? 3 : 4))

const plottedItems = computed(() =>
  props.items.map((item) => {
    const coords = compassToCoords(item.position, size.value)
    const radius = radiusFromConsistency(item.consistency, maxRadius.value, minRadius.value)
    return { ...item, coords, radius }
  }),
)

const compassSummary = computed(() =>
  plottedItems.value
    .map((item) => `${item.label ?? 'Item'} economic ${item.position.economic.toFixed(2)}, social ${item.position.social.toFixed(2)}`)
    .join('; '),
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    role="img"
    :aria-label="compact ? `Political compass compact: ${compassSummary}` : `Political compass: ${compassSummary}`"
    class="data-compass"
  >
    <defs>
      <pattern id="compass-grid" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" stroke-opacity="0.08" stroke-width="1" />
      </pattern>
    </defs>
    <rect x="0" y="0" :width="size" :height="size" rx="8" fill="url(#compass-grid)" />
    <rect x="0" y="0" :width="size / 2" :height="size / 2" fill="var(--puk-color-danger)" opacity="0.05" />
    <rect :x="size / 2" y="0" :width="size / 2" :height="size / 2" fill="var(--puk-color-warning)" opacity="0.05" />
    <rect x="0" :y="size / 2" :width="size / 2" :height="size / 2" fill="var(--puk-color-player-focus)" opacity="0.05" />
    <rect :x="size / 2" :y="size / 2" :width="size / 2" :height="size / 2" fill="var(--puk-color-success)" opacity="0.05" />

    <!-- Quadrant gridlines -->
    <line
      :x1="size / 2"
      y1="0"
      :x2="size / 2"
      :y2="size"
      stroke="currentColor"
      stroke-opacity="0.25"
      stroke-width="1"
    />
    <line
      x1="0"
      :y1="size / 2"
      :x2="size"
      :y2="size / 2"
      stroke="currentColor"
      stroke-opacity="0.25"
      stroke-width="1"
    />
    <rect
      x="0"
      y="0"
      :width="size"
      :height="size"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.15"
      stroke-width="1"
    />

    <!-- Axis labels (full mode only) -->
    <template v-if="!compact">
      <text :x="size / 2" y="12" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.6">
        Authoritarian
      </text>
      <text :x="size / 2" :y="size - 4" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.6">
        Libertarian
      </text>
      <text x="4" :y="size / 2 - 4" font-size="9" fill="currentColor" opacity="0.6">Left</text>
      <text :x="size - 4" :y="size / 2 - 4" text-anchor="end" font-size="9" fill="currentColor" opacity="0.6">
        Right
      </text>
    </template>

    <!-- Plotted items -->
    <g v-for="(item, index) in plottedItems" :key="item.label ?? index">
      <circle
        :cx="item.coords.x"
        :cy="item.coords.y"
        :r="item.radius"
        :fill="item.colour"
        fill-opacity="0.3"
        :stroke="item.colour"
        stroke-width="2"
      />
      <circle
        :cx="item.coords.x"
        :cy="item.coords.y"
        :r="Math.max(2, item.radius * 0.28)"
        fill="var(--puk-color-text)"
        fill-opacity="0.82"
      />
      <text
        v-if="!compact && item.label"
        :x="item.coords.x"
        :y="item.coords.y - item.radius - 5"
        text-anchor="middle"
        font-size="9"
        fill="currentColor"
        opacity="0.74"
      >
        {{ item.label }}
      </text>
    </g>
  </svg>
</template>
