import { computed } from 'vue'
import { useSaveStore, type ImportConflict } from '@/stores/save'
import type { SaveSummary } from '@/types'

/** Backs `SaveManagementPanel.vue`: manual-slot listing plus the create/overwrite/rename/delete/
 * export/import commands, with export/import's DOM/file-handling kept here (the store itself
 * never touches `Blob`/anchors/`FileReader` — see `exportSave`'s own comment). */
export function useSaveManagement() {
  const save = useSaveStore()

  const manualSaves = computed(() =>
    [...save.saves].filter((s) => s.kind === 'manual').sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
  )

  async function refresh() {
    await save.refreshSaves()
  }

  async function createSave(label: string) {
    await save.createManualSave(label)
  }

  async function overwriteSave(id: string) {
    await save.overwriteManualSave(id)
  }

  async function renameSave(id: string, label: string) {
    await save.renameManualSave(id, label)
  }

  async function deleteSave(id: string) {
    await save.deleteSave(id)
  }

  async function exportSave(id: string) {
    const result = await save.exportSave(id)
    if (!result) return
    const blob = new Blob([result.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = result.filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importSaveFile(file: File, opts: { confirmOverwrite?: boolean } = {}) {
    const text = await file.text()
    return save.importSave(text, opts)
  }

  return {
    manualSaves,
    lastError: computed(() => save.lastError),
    refresh,
    createSave,
    overwriteSave,
    renameSave,
    deleteSave,
    exportSave,
    importSaveFile,
  }
}

export type { ImportConflict, SaveSummary }
