<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
    <p class="text-xs uppercase tracking-wide text-zinc-500">{{ label }}</p>
    <slot />
    <p v-if="$slots.hint" class="mt-1 text-xs text-zinc-400"><slot name="hint" /></p>
  </div>
</template>
