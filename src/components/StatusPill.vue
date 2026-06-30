<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  }>(),
  {
    tone: 'default',
  },
)
</script>

<template>
  <span class="hud-status-pill" :class="`hud-status-pill--${tone}`">
    <slot />
  </span>
</template>
