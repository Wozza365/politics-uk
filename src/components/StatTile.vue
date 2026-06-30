<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <div class="hud-stat-tile">
    <p class="hud-stat-label">{{ label }}</p>
    <slot />
    <p v-if="$slots.hint" class="hud-stat-hint"><slot name="hint" /></p>
  </div>
</template>
