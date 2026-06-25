import { defineStore } from 'pinia'
import type { CouncilLevelId } from './scenario'

export type Screen = 'start' | 'loading' | 'game' | 'result'

export type GameView = 'westminster' | 'regional' | 'councils'
export type MapRendererChoice = 'geographic' | 'hex'

export const useUiStore = defineStore('ui', {
  state: () => ({
    screen: 'start' as Screen,
    activeView: 'westminster' as GameView,
    activeCouncilLevel: 'local' as CouncilLevelId,
    westminsterRenderer: 'geographic' as MapRendererChoice,
  }),
  actions: {
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
