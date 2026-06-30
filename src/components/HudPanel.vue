<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: string
    tone?: 'default' | 'floating' | 'modal'
  }>(),
  {
    as: 'section',
    tone: 'default',
  },
)
</script>

<template>
  <component :is="as" class="hud-panel" :class="`hud-panel--${tone}`">
    <slot />
  </component>
</template>
