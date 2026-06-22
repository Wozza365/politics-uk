import { onScopeDispose, watch } from 'vue'
import { useGameStore } from '@/stores/game'

/** Drives `game.tickDay()` once per `game.clock.msPerDay` while `game.clock.running`,
 * and auto-pauses whenever an action-required event is pending (spec §9.5). Uses a single
 * timer with a remaining-time carry-over so pausing/resuming doesn't lose or double-count
 * progress towards the next tick. */
export function useGameClock() {
  const game = useGameStore()

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let tickStartedAt = 0
  let remainingMs = game.clock.msPerDay

  function clearTimer() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  function scheduleNext() {
    tickStartedAt = Date.now()
    timeoutId = setTimeout(() => {
      game.tickDay()
      remainingMs = game.clock.msPerDay
      if (game.clock.running) scheduleNext()
    }, remainingMs)
  }

  function start() {
    if (timeoutId !== null) return
    scheduleNext()
  }

  function pause() {
    if (timeoutId === null) return
    remainingMs = Math.max(0, remainingMs - (Date.now() - tickStartedAt))
    clearTimer()
  }

  watch(
    () => game.clock.running,
    (running) => (running ? start() : pause()),
    { immediate: true, flush: 'sync' },
  )

  watch(
    () => game.pendingEvents.length > 0,
    (hasPendingEvent) => {
      if (hasPendingEvent) game.pauseClock()
    },
    { flush: 'sync' },
  )

  onScopeDispose(clearTimer)
}
