<script setup lang="ts">
defineProps<{
  labelledBy?: string
}>()
</script>

<template>
  <div class="hud-modal-backdrop" role="dialog" aria-modal="true" :aria-labelledby="labelledBy">
    <section class="hud-modal-surface">
      <slot />
    </section>
  </div>
</template>
