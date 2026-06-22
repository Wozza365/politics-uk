import { defineStore } from 'pinia'

export type Screen = 'start' | 'loading' | 'game' | 'result'

export type GameView = 'westminster' | 'holyrood' | 'senedd' | 'ni-assembly' | 'london' | 'councils'

export const useUiStore = defineStore('ui', {
  state: () => ({
    screen: 'start' as Screen,
    activeView: 'westminster' as GameView,
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
  },
})
