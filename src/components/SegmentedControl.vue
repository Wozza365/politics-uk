<script setup lang="ts">
export interface SegmentedOption {
  value: string | number
  label: string
  disabled?: boolean
  title?: string
}

defineProps<{
  options: SegmentedOption[]
  modelValue: string | number
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>

<template>
  <div class="hud-segmented" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="hud-segmented-button"
      :class="modelValue === option.value ? 'hud-segmented-button--selected' : ''"
      :aria-checked="modelValue === option.value"
      :disabled="option.disabled"
      :title="option.title"
      @click="!option.disabled && emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
