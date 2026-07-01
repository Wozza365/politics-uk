<script setup lang="ts">
import { computed } from 'vue'
import type { Party, PartyOfficer } from '@/types'

const props = withDefaults(
  defineProps<{
    party?: Party | null
    officer?: PartyOfficer | null
    size?: 'sm' | 'md'
    showName?: boolean
  }>(),
  {
    party: null,
    officer: null,
    size: 'md',
    showName: false,
  },
)

const name = computed(() => props.officer?.personName ?? 'Leader TBC')
const initials = computed(() =>
  name.value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'UK',
)
const primary = computed(() => props.party?.colours.primary ?? 'var(--puk-color-data-neutral)')
const onPrimary = computed(() => props.party?.colours.onPrimary ?? '#101114')
</script>

<template>
  <figure
    class="leader-portrait"
    :class="`leader-portrait--${size}`"
    :style="{ '--party-accent': primary, '--party-on-accent': onPrimary }"
    :aria-label="`${name} portrait placeholder`"
  >
    <span class="leader-portrait__silhouette" aria-hidden="true">
      <span class="leader-portrait__head"></span>
      <span class="leader-portrait__shoulders"></span>
    </span>
    <span class="leader-portrait__initials" aria-hidden="true">{{ initials }}</span>
    <figcaption v-if="showName" class="leader-portrait__caption">{{ name }}</figcaption>
  </figure>
</template>
