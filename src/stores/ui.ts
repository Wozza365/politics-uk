import { defineStore } from 'pinia'
import type { CouncilLevelId } from './scenario'

export type Screen = 'start' | 'loading' | 'game' | 'result'

export type GameView = 'westminster' | 'regional' | 'councils'
export type MapRendererChoice = 'geographic' | 'hex'

/** External request for `MapView.vue` to focus a region — the only seam other components use to
 * drive the map (spec/CLAUDE.md: "never reach into SVG/DOM from game logic"). `MapView` alone
 * interprets this via its own internal `activate()`; it clears the request once handled. */
export interface MapFocusRequest {
  view: GameView
  councilLevel?: CouncilLevelId // required when view === 'councils'
  geometryRef: string // passed straight to MapView's activate()
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    screen: 'start' as Screen,
    activeView: 'westminster' as GameView,
    activeCouncilLevel: 'local' as CouncilLevelId,
    westminsterRenderer: 'geographic' as MapRendererChoice,
    // Shared pause gate (P2.8): any panel that wants the clock paused while open calls
    // openMenu()/closeMenu() instead of pausing/resuming the clock directly, so two panels open
    // at once can't have one's close prematurely resume the clock while the other is still open.
    openMenus: 0,
    byElectionsPanelOpen: false,
    mapFocusRequest: null as MapFocusRequest | null,
  }),
  actions: {
    openMenu() {
      this.openMenus++
    },
    closeMenu() {
      this.openMenus = Math.max(0, this.openMenus - 1)
    },
    toggleByElectionsPanel() {
      this.byElectionsPanelOpen = !this.byElectionsPanelOpen
    },
    closeByElectionsPanel() {
      this.byElectionsPanelOpen = false
    },
    requestMapFocus(request: MapFocusRequest) {
      this.mapFocusRequest = request
    },
    clearMapFocus() {
      this.mapFocusRequest = null
    },
    goToStart() {
      this.screen = 'start'
    },
    goToLoading() {
      this.screen = 'loading'
    },
    goToGame() {
      this.screen = 'game'
    },
    goToResult() {
      this.screen = 'result'
    },
    setActiveView(view: GameView) {
      this.activeView = view
    },
    setActiveCouncilLevel(level: CouncilLevelId) {
      this.activeCouncilLevel = level
    },
    setWestminsterRenderer(renderer: MapRendererChoice) {
      this.westminsterRenderer = renderer
    },
  },
})
