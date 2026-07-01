import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from './ui'

describe('useUiStore — P3.2 screen lifecycle', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size
      },
    }
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts on the title screen', () => {
    const ui = useUiStore()
    expect(ui.screen).toBe('title')
  })

  it('walks every legal screen transition', () => {
    const ui = useUiStore()

    ui.goToNewGame()
    expect(ui.screen).toBe('newGame')

    ui.goToLoading()
    expect(ui.screen).toBe('loading')

    ui.goToGame()
    expect(ui.screen).toBe('game')

    ui.goToResult()
    expect(ui.screen).toBe('result')

    ui.goToTitle()
    expect(ui.screen).toBe('title')

    ui.goToLoadGame()
    expect(ui.screen).toBe('loadGame')

    ui.goToRestoring('autosave')
    expect(ui.screen).toBe('restoring')
    expect(ui.pendingRestoreId).toBe('autosave')
  })

  it('requestConfirm resolves true once resolveConfirm(true) is called', async () => {
    const ui = useUiStore()

    const pending = ui.requestConfirm({ title: 'Sure?', message: 'Really sure?' })
    expect(ui.confirmModal?.request.title).toBe('Sure?')

    ui.resolveConfirm(true)
    expect(await pending).toBe(true)
    expect(ui.confirmModal).toBeNull()
  })

  it('requestConfirm resolves false on cancel from a destructive confirmation', async () => {
    const ui = useUiStore()

    const pending = ui.requestConfirm({ title: 'Restart?', message: 'This replaces the autosave.' })
    ui.resolveConfirm(false)

    expect(await pending).toBe(false)
    expect(ui.confirmModal).toBeNull()
  })

  it('resolveConfirm is a no-op without a pending prompt', () => {
    const ui = useUiStore()
    expect(() => ui.resolveConfirm(true)).not.toThrow()
    expect(ui.confirmModal).toBeNull()
  })

  it('toggleGameMenu and the shared pause-gate panels are independent flags', () => {
    const ui = useUiStore()
    ui.toggleGameMenu()
    expect(ui.gameMenuOpen).toBe(true)
    ui.closeGameMenu()
    expect(ui.gameMenuOpen).toBe(false)
  })

  it('hydrateFromSaveState always resets transient panel/menu/modal state', () => {
    const ui = useUiStore()
    ui.toggleGameMenu()
    ui.toggleSaveManagementPanel()
    ui.toggleByElectionsPanel()
    ui.openMenu()
    ui.requestConfirm({ title: 'x', message: 'y' })

    ui.hydrateFromSaveState({ activeView: 'regional', activeCouncilLevel: 'county', westminsterRenderer: 'hex' })

    expect(ui.gameMenuOpen).toBe(false)
    expect(ui.saveManagementPanelOpen).toBe(false)
    expect(ui.byElectionsPanelOpen).toBe(false)
    expect(ui.openMenus).toBe(0)
    expect(ui.confirmModal).toBeNull()
    expect(ui.activeView).toBe('regional')
  })

  it('persists presentation preferences locally without adding them to save state', () => {
    const ui = useUiStore()

    ui.setSoundEnabled(true)
    ui.setSoundEffectsVolume(1.5)
    ui.setAmbienceVolume(0.4)
    ui.setMotionPreference('reduced')

    expect(ui.presentation.soundEnabled).toBe(true)
    expect(ui.presentation.soundEffectsVolume).toBe(1)
    expect(ui.presentation.ambienceVolume).toBe(0.4)
    expect(ui.presentation.motionPreference).toBe('reduced')
    expect(ui.toSaveState()).not.toHaveProperty('presentation')

    const restored = useUiStore()
    restored.presentation.soundEnabled = false
    restored.loadPresentationPreferences()

    expect(restored.presentation.soundEnabled).toBe(true)
    expect(restored.presentation.motionPreference).toBe('reduced')
  })
})
