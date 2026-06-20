<script setup lang="ts">
// Small visual badge for a 1-5 DifficultyBand (spec §11.1): a row of five dots,
// filled up to the band, plus the band's text label.
import { computed } from 'vue'
import type { DifficultyBand } from '@/sim/difficulty'
import { DIFFICULTY_LABELS } from '@/sim/difficulty'

const props = defineProps<{
  band: DifficultyBand
}>()

const dots = computed(() => [1, 2, 3, 4, 5] as DifficultyBand[])
const label = computed(() => DIFFICULTY_LABELS[props.band])
</script>

<template>
  <div class="flex items-center gap-1.5 text-xs" :title="`Difficulty: ${label}`">
    <span class="flex gap-0.5">
      <span
        v-for="dot in dots"
        :key="dot"
        class="h-1.5 w-1.5 rounded-full"
        :class="dot <= band ? 'bg-current' : 'bg-current opacity-25'"
      />
    </span>
    <span class="opacity-80">{{ label }}</span>
  </div>
</template>
