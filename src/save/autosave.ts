// Pure, store-free autosave coalescing (P3.1). `stores/save.ts` is the only caller — it wires
// `schedule()` to completed game-store domain actions (via Pinia's `$onAction`) and `flush()` to
// the page-visibility seam below. Nothing here touches Pinia, IndexedDB, or (outside the seam)
// `document`/`window` directly, so it can be driven entirely by fake timers and a fake seam in
// tests.

export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface AutosaveStatus {
  state: AutosaveState
  lastSavedAt: string | null
  error: string | null
}

/** Abstracts `document`'s visibility/pagehide events behind a seam so a scheduler's flush-on-hide
 * behaviour can be exercised without a real browser ("page-visibility flush invocation through an
 * abstracted browser-event seam" — task contract). */
export interface BrowserLifecycleSeam {
  addListener(handler: () => void): () => void
}

export const documentLifecycleSeam: BrowserLifecycleSeam = {
  addListener(handler) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handler()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', handler)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', handler)
    }
  },
}

export interface AutosaveSchedulerOptions {
  /** Performs the actual write (e.g. `saveStore.writeSave('autosave')`). Rejecting is reported as
   * a recoverable status, never thrown back at the caller. */
  write: () => Promise<void>
  /** Debounce window used to coalesce a burst of trigger actions into one write. */
  debounceMs?: number
  onStatusChange?: (status: AutosaveStatus) => void
  seam?: BrowserLifecycleSeam
  now?: () => string
}

/** Coalesces bursts of `schedule()` calls into a single debounced write, with an immediate
 * `flush()` escape hatch for the player-facing "save now" command and the page-visibility seam
 * (where waiting out the debounce window risks losing the write to a closing tab). A write already
 * in flight is never overlapped with another — a `schedule()`/`flush()` that arrives mid-write
 * queues one more pass once it settles, so the latest state always ends up persisted. */
export class AutosaveScheduler {
  private readonly write: () => Promise<void>
  private readonly debounceMs: number
  private readonly onStatusChange?: (status: AutosaveStatus) => void
  private readonly now: () => string
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> | null = null
  private rerunRequested = false
  private unsubscribeSeam: (() => void) | null = null
  private status: AutosaveStatus = { state: 'idle', lastSavedAt: null, error: null }

  constructor(options: AutosaveSchedulerOptions) {
    this.write = options.write
    this.debounceMs = options.debounceMs ?? 1000
    this.onStatusChange = options.onStatusChange
    this.now = options.now ?? (() => new Date().toISOString())
    if (options.seam) this.attach(options.seam)
  }

  getStatus(): AutosaveStatus {
    return this.status
  }

  private setStatus(patch: Partial<AutosaveStatus>) {
    this.status = { ...this.status, ...patch }
    this.onStatusChange?.(this.status)
  }

  /** Called after every completed trigger action. */
  schedule(): void {
    this.setStatus({ state: 'pending' })
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.runWrite()
    }, this.debounceMs)
  }

  /** Cancels any pending debounce and runs the write now. A no-op when nothing is pending. */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
      await this.runWrite()
      return
    }
    if (this.status.state === 'pending') await this.runWrite()
  }

  private async runWrite(): Promise<void> {
    if (this.inFlight) {
      this.rerunRequested = true
      return this.inFlight
    }
    this.setStatus({ state: 'saving' })
    this.inFlight = this.write()
      .then(() => {
        this.setStatus({ state: 'saved', lastSavedAt: this.now(), error: null })
      })
      .catch((error: unknown) => {
        this.setStatus({ state: 'error', error: error instanceof Error ? error.message : String(error) })
      })
      .finally(() => {
        this.inFlight = null
        if (this.rerunRequested) {
          this.rerunRequested = false
          void this.runWrite()
        }
      })
    return this.inFlight
  }

  /** Wires a page-visibility/pagehide seam to `flush()`. */
  attach(seam: BrowserLifecycleSeam): void {
    this.unsubscribeSeam?.()
    this.unsubscribeSeam = seam.addListener(() => void this.flush())
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.unsubscribeSeam?.()
    this.unsubscribeSeam = null
  }
}
