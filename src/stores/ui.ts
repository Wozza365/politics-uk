import { defineStore } from 'pinia'
import { COUNCIL_LEVELS, type CouncilLevelId } from './scenario'
import type { UiSaveStateV1 } from '@/types'

// P3.2: title/main-menu, new-game setup, load-game browser, the brief spinner while a *new*
// campaign initialises, restoring (loading an *existing* save), the live game, and the post-GE
// result screen. Replaces the MVP's one-way 'start' -> 'loading' -> 'game'.
export type Screen = 'title' | 'newGame' | 'loadGame' | 'loading' | 'restoring' | 'game' | 'result'

export type GameView = 'westminster' | 'regional' | 'councils'
export type MapRendererChoice = 'geographic' | 'hex'

const GAME_VIEWS: GameView[] = ['westminster', 'regional', 'councils']
const MAP_RENDERER_CHOICES: MapRendererChoice[] = ['geographic', 'hex']

export type MapOverlayKey = 'commitments' | 'contests' | 'opponentActivity'

/** External request for `MapView.vue` to focus a region — the only seam other components use to
 * drive the map (spec/CLAUDE.md: "never reach into SVG/DOM from game logic"). `MapView` alone
 * interprets this via its own internal `activate()`; it clears the request once handled. */
export interface MapFocusRequest {
  view: GameView
  councilLevel?: CouncilLevelId // required when view === 'councils'
  geometryRef: string // passed straight to MapView's activate()
}

/** A screen-level "are you sure?" prompt (P3.2 step 1) — the single source of truth for
 * destructive *screen transitions* (new game over an active campaign, return to menu, restart),
 * kept in `ui.ts` rather than as a component-local boolean per screen so it can't conflict after a
 * load. Distinct from `SaveManagementPanel.vue`'s own local confirm state, which only ever guards
 * that panel's delete/import-overwrite actions. */
export interface ConfirmModalRequest {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    screen: 'title' as Screen,
    // Set by `goToRestoring` so `RestoreScreen.vue` knows which save id to read — cleared once
    // restore succeeds or the player bails back to the load list.
    pendingRestoreId: null as string | null,
    activeView: 'westminster' as GameView,
    activeCouncilLevel: 'local' as CouncilLevelId,
    westminsterRenderer: 'geographic' as MapRendererChoice,
    // Shared pause gate (P2.8): any panel that wants the clock paused while open calls
    // openMenu()/closeMenu() instead of pausing/resuming the clock directly, so two panels open
    // at once can't have one's close prematurely resume the clock while the other is still open.
    openMenus: 0,
    byElectionsPanelOpen: false,
    saveManagementPanelOpen: false,
    targetingPanelOpen: false,
    gameMenuOpen: false,
    helpPanelOpen: false,
    activeExplanationId: null as string | null,
    mapFocusRequest: null as MapFocusRequest | null,
    // P3.4 map overlay toggles — transient display preferences for `MapView.vue`'s targeting
    // tinting pass, never persisted (see `hydrateFromSaveState`, which always resets to defaults).
    mapOverlays: { commitments: true, contests: true, opponentActivity: true } as Record<MapOverlayKey, boolean>,
    // Transient — `resolve` is a callback, never persisted (see `hydrateFromSaveState`, which
    // always clears this like every other open-panel flag). Only one prompt is ever pending at a
    // time, matching the UI: a screen-level transition is never queued behind another one.
    confirmModal: null as { request: ConfirmModalRequest; resolve: (confirmed: boolean) => void } | null,
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
    toggleSaveManagementPanel() {
      this.saveManagementPanelOpen = !this.saveManagementPanelOpen
    },
    closeSaveManagementPanel() {
      this.saveManagementPanelOpen = false
    },
    toggleTargetingPanel() {
      this.targetingPanelOpen = !this.targetingPanelOpen
    },
    closeTargetingPanel() {
      this.targetingPanelOpen = false
    },
    toggleMapOverlay(key: MapOverlayKey) {
      this.mapOverlays[key] = !this.mapOverlays[key]
    },
    toggleGameMenu() {
      this.gameMenuOpen = !this.gameMenuOpen
    },
    closeGameMenu() {
      this.gameMenuOpen = false
    },
    toggleHelpPanel() {
      this.helpPanelOpen = !this.helpPanelOpen
    },
    closeHelpPanel() {
      this.helpPanelOpen = false
    },
    showExplanation(id: string) {
      this.activeExplanationId = id
    },
    closeExplanation() {
      this.activeExplanationId = null
    },
    requestMapFocus(request: MapFocusRequest) {
      this.mapFocusRequest = request
    },
    clearMapFocus() {
      this.mapFocusRequest = null
    },
    goToTitle() {
      this.screen = 'title'
    },
    goToNewGame() {
      this.screen = 'newGame'
    },
    goToLoadGame() {
      this.screen = 'loadGame'
    },
    goToLoading() {
      this.screen = 'loading'
    },
    goToRestoring(saveId: string) {
      this.pendingRestoreId = saveId
      this.screen = 'restoring'
    },
    goToGame() {
      this.screen = 'game'
    },
    goToResult() {
      this.screen = 'result'
    },
    /** Awaitable confirm prompt — resolves once the player picks an option in the `ConfirmDialog`
     * `App.vue` mounts for `confirmModal`. */
    requestConfirm(request: ConfirmModalRequest): Promise<boolean> {
      return new Promise((resolve) => {
        this.confirmModal = { request, resolve }
      })
    },
    resolveConfirm(confirmed: boolean) {
      if (!this.confirmModal) return
      const { resolve } = this.confirmModal
      this.confirmModal = null
      resolve(confirmed)
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
    /** The only `ui` fields worth persisting (P3.0) — display preferences, never an open
     * panel/modal or a running timer. */
    toSaveState(): UiSaveStateV1 {
      return {
        activeView: this.activeView,
        activeCouncilLevel: this.activeCouncilLevel,
        westminsterRenderer: this.westminsterRenderer,
      }
    },
    /** Restores display preferences from a save, falling back to the default for anything that
     * doesn't match a value this build still recognises, and always resetting transient
     * panel/modal/focus state regardless of what was saved (P3.0). */
    hydrateFromSaveState(state: UiSaveStateV1) {
      const councilLevelIds: CouncilLevelId[] = COUNCIL_LEVELS.map((level) => level.id)
      this.activeView = GAME_VIEWS.includes(state.activeView as GameView) ? (state.activeView as GameView) : 'westminster'
      this.activeCouncilLevel = councilLevelIds.includes(state.activeCouncilLevel as CouncilLevelId)
        ? (state.activeCouncilLevel as CouncilLevelId)
        : 'local'
      this.westminsterRenderer = MAP_RENDERER_CHOICES.includes(state.westminsterRenderer as MapRendererChoice)
        ? (state.westminsterRenderer as MapRendererChoice)
        : 'geographic'
      this.openMenus = 0
      this.byElectionsPanelOpen = false
      this.saveManagementPanelOpen = false
      this.targetingPanelOpen = false
      this.gameMenuOpen = false
      this.helpPanelOpen = false
      this.activeExplanationId = null
      this.mapFocusRequest = null
      this.confirmModal = null
      this.mapOverlays = { commitments: true, contests: true, opponentActivity: true }
    },
  },
})
