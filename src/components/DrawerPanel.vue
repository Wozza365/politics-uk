<script setup lang="ts">
import HudPanel from './HudPanel.vue'

withDefaults(
  defineProps<{
    labelledBy?: string
  }>(),
  {
    labelledBy: undefined,
  },
)
</script>

<template>
  <HudPanel tone="floating" role="dialog" aria-modal="false" :aria-labelledby="labelledBy">
    <slot />
  </HudPanel>
</template>
