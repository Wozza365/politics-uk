<script setup lang="ts">
defineProps<{
  label: string
  description: string
  buttonLabel: string
  cooldownDays: number
}>()
const emit = defineEmits<{ activate: [] }>()
</script>

<template>
  <div class="w-full rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-left">
    <p class="text-xs font-semibold uppercase tracking-wide text-zinc-300">{{ label }}</p>
    <p class="mt-1 text-xs text-zinc-500">{{ description }}</p>
    <button
      type="button"
      class="mt-2 w-full rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2 py-1.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700/80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-800/80"
      :disabled="cooldownDays > 0"
      @click="emit('activate')"
    >
      {{ cooldownDays > 0 ? `Ready in ${cooldownDays}d` : buttonLabel }}
    </button>
  </div>
</template>
