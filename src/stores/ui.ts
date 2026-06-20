import { defineStore } from 'pinia'

export type Screen = 'start' | 'loading' | 'game'

export const useUiStore = defineStore('ui', {
  state: () => ({
    screen: 'start' as Screen,
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
  },
})
