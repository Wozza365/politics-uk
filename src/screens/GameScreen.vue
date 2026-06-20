<script setup lang="ts">
// Placeholder shell for P1.0 — mounts the existing MapView for now; the full game
// layout (party panel, feed, clock, hemicycle) is built out by later P1.x tasks.
import MapView from '@/components/MapView.vue'
</script>

<template>
  <main class="flex h-screen w-screen items-center justify-center bg-zinc-900 p-12">
    <MapView />
  </main>
</template>
