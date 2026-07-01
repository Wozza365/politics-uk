<script setup lang="ts">
import { computed } from 'vue'
import type { Party } from '@/types'

const props = withDefaults(
  defineProps<{
    party?: Party | null
    label?: string
    size?: 'xs' | 'sm' | 'md' | 'lg'
    decorative?: boolean
  }>(),
  {
    party: null,
    label: '',
    size: 'md',
    decorative: false,
  },
)

const text = computed(() => {
  const source = props.party?.shortName || props.label || 'UK'
  const compact = source.replace(/[^A-Za-z0-9]/g, '')
  return (compact || source).slice(0, 4)
})

const primary = computed(() => props.party?.colours.primary ?? 'var(--puk-color-data-neutral)')
const onPrimary = computed(() => props.party?.colours.onPrimary ?? '#101114')
const name = computed(() => props.party?.name ?? (props.label || 'party'))
</script>

<template>
  <span
    class="party-identity-mark"
    :class="`party-identity-mark--${size}`"
    :style="{ '--party-accent': primary, '--party-on-accent': onPrimary }"
    :aria-hidden="decorative || undefined"
    :aria-label="decorative ? undefined : `${name} mark`"
    :role="decorative ? undefined : 'img'"
  >
    <span class="party-identity-mark__text">{{ text }}</span>
  </span>
</template>
