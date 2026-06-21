<script setup lang="ts">
import MapView from '@/components/MapView.vue'
import PartyPanel from '@/components/PartyPanel.vue'
import HemicycleView from '@/components/HemicycleView.vue'
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

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
        <slot name="event-feed">
          <div class="space-y-3">
            <article class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
              <p class="font-semibold text-zinc-100">Awaiting the first tick</p>
              <p class="mt-1 text-zinc-300">Events and player actions will appear here.</p>
            </article>
          </div>
        </slot>
      </div>
    </section>

    <PartyPanel />

    <section
      class="absolute right-4 top-4 z-20 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/85 text-right text-sm shadow-2xl backdrop-blur-sm"
      aria-label="Game clock and election countdown"
    >
      <slot name="clock">
        <div class="px-4 py-3">
          <p class="font-semibold text-zinc-100">1 January 2025</p>
          <p class="text-zinc-400">General Election countdown</p>
        </div>
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
        <div class="flex items-center justify-center gap-2 px-3 py-3 text-sm">
          <button type="button" class="rounded-xl bg-zinc-100 px-3 py-1 text-zinc-900">Westminster</button>
          <button type="button" class="rounded-xl px-3 py-1 text-zinc-400" disabled>Holyrood</button>
          <button type="button" class="rounded-xl px-3 py-1 text-zinc-400" disabled>Senedd</button>
          <button type="button" class="rounded-xl px-3 py-1 text-zinc-400" disabled>Councils</button>
        </div>
      </slot>
    </nav>
  </main>
</template>
