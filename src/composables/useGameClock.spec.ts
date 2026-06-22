import { effectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameClock } from './useGameClock'
import { useGameStore } from '@/stores/game'

describe('useGameClock', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks the date forward once per msPerDay while running', () => {
    const game = useGameStore()
    game.date = '2025-01-01'
    game.clock.running = true
    const scope = effectScope()
    scope.run(() => useGameClock())

    vi.advanceTimersByTime(game.clock.msPerDay)
    expect(game.date).toBe('2025-01-02')

    vi.advanceTimersByTime(game.clock.msPerDay)
    expect(game.date).toBe('2025-01-03')

    scope.stop()
  })

  it('does not tick while paused, and resumes ticking once unpaused', () => {
    const game = useGameStore()
    game.date = '2025-01-01'
    game.clock.running = false
    const scope = effectScope()
    scope.run(() => useGameClock())

    vi.advanceTimersByTime(game.clock.msPerDay * 3)
    expect(game.date).toBe('2025-01-01')

    game.clock.running = true
    vi.advanceTimersByTime(game.clock.msPerDay)
    expect(game.date).toBe('2025-01-02')

    scope.stop()
  })

  it('preserves remaining time across a pause instead of restarting the day', () => {
    const game = useGameStore()
    game.date = '2025-01-01'
    game.clock.running = true
    const scope = effectScope()
    scope.run(() => useGameClock())

    vi.advanceTimersByTime(game.clock.msPerDay * 0.75)
    game.clock.running = false
    vi.advanceTimersByTime(game.clock.msPerDay * 5)
    expect(game.date).toBe('2025-01-01')

    game.clock.running = true
    vi.advanceTimersByTime(game.clock.msPerDay * 0.25)
    expect(game.date).toBe('2025-01-02')

    scope.stop()
  })

  it('auto-pauses the clock as soon as an event is pending, and stops ticking', () => {
    const game = useGameStore()
    game.date = '2025-01-01'
    game.clock.running = true
    const scope = effectScope()
    scope.run(() => useGameClock())

    game.pendingEvents.push({ id: 'evt-1' })
    expect(game.clock.running).toBe(false)

    vi.advanceTimersByTime(game.clock.msPerDay * 3)
    expect(game.date).toBe('2025-01-01')

    scope.stop()
  })

  it('resumes once the pending event is resolved', () => {
    const game = useGameStore()
    game.date = '2025-01-01'
    game.clock.running = true
    const scope = effectScope()
    scope.run(() => useGameClock())

    game.pendingEvents.push({ id: 'evt-1' })
    game.resolvePendingEvent('choice')
    expect(game.clock.running).toBe(true)

    vi.advanceTimersByTime(game.clock.msPerDay)
    expect(game.date).toBe('2025-01-02')

    scope.stop()
  })

  it('clears its timer on scope disposal so no ticks leak after unmount', () => {
    const game = useGameStore()
    game.date = '2025-01-01'
    game.clock.running = true
    const scope = effectScope()
    scope.run(() => useGameClock())

    scope.stop()
    vi.advanceTimersByTime(game.clock.msPerDay * 5)
    expect(game.date).toBe('2025-01-01')
  })
})
