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
import SaveManagementPanel from '@/components/SaveManagementPanel.vue'
import GameMenuPanel from '@/components/GameMenuPanel.vue'
import TargetingPanel from '@/components/TargetingPanel.vue'
import CampaignJournal from '@/components/CampaignJournal.vue'
import ViewSwitcher from '@/components/ViewSwitcher.vue'
import GoalStatusStrip from '@/components/GoalStatusStrip.vue'
import TutorialOverlay from '@/components/TutorialOverlay.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import ExplanationDetails from '@/components/ExplanationDetails.vue'
import HudPanel from '@/components/HudPanel.vue'
import PanelHeader from '@/components/PanelHeader.vue'
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
  <main class="relative h-screen w-screen overflow-hidden bg-puk-app-bg text-puk-text">
    <HudPanel
      class="hud-feed absolute left-4 top-4 bottom-4 z-20 flex w-80 max-w-[calc(100vw-2rem)] flex-col"
      aria-label="Event feed"
    >
      <PanelHeader title="Event feed" subtitle="Chronological log" />

      <div class="hud-panel-body min-h-0 flex-1 text-sm">
        <slot name="event-feed">
          <EventFeed />
        </slot>
      </div>
    </HudPanel>

    <PartyPanel />
    <ByElectionsPanel />
    <TargetingPanel />
    <CampaignJournal />
    <SaveManagementPanel />
    <GameMenuPanel />
    <GoalStatusStrip />
    <HelpPanel />
    <TutorialOverlay />
    <ExplanationDetails />

    <HudPanel
      class="hud-clock absolute right-4 top-4 z-20 w-80 max-w-[calc(100vw-2rem)] text-sm"
      aria-label="Game clock and election countdown"
    >
      <slot name="clock">
        <GameClock />
      </slot>
    </HudPanel>

    <section
      class="hud-map absolute inset-x-0 bottom-52 top-36 z-10 flex items-center justify-center px-8"
      aria-label="Westminster map"
    >
      <div class="h-full w-full max-w-6xl">
        <slot name="map">
          <MapView />
        </slot>
      </div>
    </section>

    <HudPanel
      class="hud-hemicycle absolute bottom-28 left-1/2 z-20 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 text-sm"
      aria-label="Party makeup"
    >
      <slot name="hemicycle">
        <HemicycleView />
      </slot>
    </HudPanel>

    <HudPanel
      as="nav"
      class="hud-switcher absolute bottom-3 left-1/2 z-20 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2"
      aria-label="View switcher"
    >
      <slot name="view-switcher">
        <ViewSwitcher />
      </slot>
    </HudPanel>
  </main>
</template>
