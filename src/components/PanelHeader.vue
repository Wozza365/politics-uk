<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  kicker?: string
}>()
</script>

<template>
  <header class="hud-panel-header">
    <div class="min-w-0">
      <p v-if="kicker" class="hud-panel-kicker">{{ kicker }}</p>
      <h2 class="hud-panel-title">{{ title }}</h2>
      <p v-if="subtitle" class="hud-panel-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="hud-panel-actions">
      <slot name="actions" />
    </div>
  </header>
</template>
