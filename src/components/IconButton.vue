<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    title?: string
    type?: 'button' | 'submit' | 'reset'
    tone?: 'default' | 'primary' | 'danger' | 'ghost'
    size?: 'sm' | 'md'
  }>(),
  {
    type: 'button',
    tone: 'default',
    size: 'md',
  },
)
</script>

<template>
  <button
    :type="type"
    class="hud-icon-button"
    :class="[`hud-icon-button--${tone}`, `hud-icon-button--${size}`]"
    :aria-label="label"
    :title="title ?? label"
  >
    <slot />
  </button>
</template>
