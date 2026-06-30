<script setup lang="ts">
import StatTile from './StatTile.vue'

defineProps<{ label: string }>()
</script>

<template>
  <StatTile :label="label">
    <slot />
    <template v-if="$slots.hint" #hint>
      <slot name="hint" />
    </template>
  </StatTile>
</template>
