<script setup lang="ts">
// Game screen (spec §9): the live play loop. `useGameClock()` (mounted by `GameClock`) drives
// `tickDay()`; this screen's only other job is to hand off to the result screen once the GE
// date resolves a win/lose (P1.13 — the end of the otherwise-automatic-from-here loop).
import { watch } from 'vue'
import MapView from '@/components/MapView.vue'
import PartyPanel from '@/components/PartyPanel.vue'
import HemicycleView from '@/components/HemicycleView.vue'
import EventFeed from '@/components/EventFeed.vue'
import GameClock from '@/components/GameClock.vue'
import ByElectionsPanel from '@/components/ByElectionsPanel.vue'
import ViewSwitcher from '@/components/ViewSwitcher.vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'

const game = useGameStore()
const ui = useUiStore()

watch(
  () => game.result,
  (result) => {
    if (result) ui.goToResult()
  },
)
</script>

<template>
  <main class="relative h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-100">
    <section
      class="absolute left-4 top-4 bottom-4 z-20 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/85 shadow-2xl backdrop-blur-sm"
      aria-label="Event feed"
    >
      <header class="border-b border-zinc-800/80 px-4 py-3">
        <p class="text-sm font-semibold tracking-wide text-zinc-100">Event feed</p>
        <p class="text-xs text-zinc-400">Chronological log</p>
      </header>

      <div class="min-h-0 flex-1 px-4 py-4 text-sm">
        <slot name="event-feed">
          <EventFeed />
        </slot>
      </div>
    </section>

    <PartyPanel />
    <ByElectionsPanel />

    <section
      class="absolute right-4 top-4 z-20 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/85 text-sm shadow-2xl backdrop-blur-sm"
      aria-label="Game clock and election countdown"
    >
      <slot name="clock">
        <GameClock />
      </slot>
    </section>

    <section
      class="absolute inset-x-0 bottom-32 top-20 z-10 flex items-center justify-center px-8"
      aria-label="Westminster map"
    >
      <div class="h-full w-full max-w-6xl">
        <slot name="map">
          <MapView />
        </slot>
      </div>
    </section>

    <section
      class="absolute bottom-20 left-1/2 z-20 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/85 text-sm shadow-2xl backdrop-blur-sm"
      aria-label="Party makeup"
    >
      <slot name="hemicycle">
        <HemicycleView />
      </slot>
    </section>

    <nav
      class="absolute bottom-4 left-1/2 z-20 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/85 shadow-2xl backdrop-blur-sm"
      aria-label="View switcher"
    >
      <slot name="view-switcher">
        <ViewSwitcher />
      </slot>
    </nav>
  </main>
</template>
