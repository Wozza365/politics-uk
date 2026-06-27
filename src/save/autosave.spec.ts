import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutosaveScheduler, type BrowserLifecycleSeam } from './autosave'

describe('AutosaveScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces a burst of schedule() calls into a single write after the debounce window', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const scheduler = new AutosaveScheduler({ write, debounceMs: 1000 })

    scheduler.schedule()
    vi.advanceTimersByTime(400)
    scheduler.schedule()
    vi.advanceTimersByTime(400)
    scheduler.schedule()
    vi.advanceTimersByTime(999)
    expect(write).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
  })

  it('reports pending -> saving -> saved through onStatusChange without claiming success early', async () => {
    let resolveWrite: () => void = () => {}
    const write = vi.fn(() => new Promise<void>((resolve) => (resolveWrite = resolve)))
    const statuses: string[] = []
    const scheduler = new AutosaveScheduler({
      write,
      debounceMs: 100,
      onStatusChange: (status) => statuses.push(status.state),
    })

    scheduler.schedule()
    expect(statuses).toEqual(['pending'])
    vi.advanceTimersByTime(100)
    await vi.waitFor(() => expect(statuses).toEqual(['pending', 'saving']))
    expect(scheduler.getStatus().state).toBe('saving')

    resolveWrite()
    await vi.waitFor(() => expect(statuses).toEqual(['pending', 'saving', 'saved']))
    expect(scheduler.getStatus().lastSavedAt).not.toBeNull()
  })

  it('surfaces a failed write as a recoverable error status instead of throwing', async () => {
    const write = vi.fn().mockRejectedValue(new Error('quota exceeded'))
    const scheduler = new AutosaveScheduler({ write, debounceMs: 10 })

    scheduler.schedule()
    vi.advanceTimersByTime(10)
    await vi.waitFor(() => expect(scheduler.getStatus().state).toBe('error'))
    expect(scheduler.getStatus().error).toContain('quota exceeded')
  })

  it('flush() cancels the pending debounce and writes immediately', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const scheduler = new AutosaveScheduler({ write, debounceMs: 5000 })

    scheduler.schedule()
    await scheduler.flush()

    expect(write).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(write).toHaveBeenCalledTimes(1) // the cancelled debounce never also fires
  })

  it('flush() is a no-op when nothing is pending', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const scheduler = new AutosaveScheduler({ write })

    await scheduler.flush()
    expect(write).not.toHaveBeenCalled()
  })

  it('queues one more write if schedule()/flush() arrives while a write is already in flight', async () => {
    let resolveFirst: () => void = () => {}
    const write = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue(undefined)
    const scheduler = new AutosaveScheduler({ write, debounceMs: 10 })

    scheduler.schedule()
    vi.advanceTimersByTime(10)
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))

    scheduler.schedule() // arrives mid-write
    vi.advanceTimersByTime(10)
    resolveFirst()

    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2))
  })

  it('invokes flush() when the page-visibility seam fires, through the abstracted seam interface', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    let fireHidden: () => void = () => {}
    const seam: BrowserLifecycleSeam = {
      addListener: (handler) => {
        fireHidden = handler
        return () => {}
      },
    }
    const scheduler = new AutosaveScheduler({ write, debounceMs: 5000, seam })

    scheduler.schedule()
    fireHidden()
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
  })

  it('dispose() unsubscribes from the seam and cancels a pending debounce', () => {
    let detached = false
    const seam: BrowserLifecycleSeam = {
      addListener: () => () => {
        detached = true
      },
    }
    const scheduler = new AutosaveScheduler({ write: vi.fn().mockResolvedValue(undefined), seam })

    scheduler.schedule()
    scheduler.dispose()

    expect(detached).toBe(true)
    expect(scheduler.getStatus().state).toBe('pending') // cancelled, not flushed
  })
})
