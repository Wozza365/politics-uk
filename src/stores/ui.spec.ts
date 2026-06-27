import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from './ui'

describe('useUiStore — P3.2 screen lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
})
