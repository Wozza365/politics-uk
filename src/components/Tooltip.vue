<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <span class="hud-tooltip">
    <slot />
    <span class="hud-tooltip-bubble" role="tooltip">{{ text }}</span>
  </span>
</template>
