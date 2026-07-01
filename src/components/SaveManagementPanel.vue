<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Pencil, RotateCcw, Save, Trash2, Upload, X } from '@lucide/vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useSaveManagement } from '@/composables/useSaveManagement'
import { useFocusTrap } from '@/composables/useFocusTrap'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import HudPanel from '@/components/HudPanel.vue'
import IconButton from '@/components/IconButton.vue'
import PanelHeader from '@/components/PanelHeader.vue'
import type { ImportConflict } from '@/stores/save'

const ui = useUiStore()
const game = useGameStore()
const { manualSaves, createSave, overwriteSave, renameSave, deleteSave, exportSave, importSaveFile } = useSaveManagement()
const panel = ref<HTMLElement | null>(null)

function closePanel() {
  ui.closeSaveManagementPanel()
  ui.closeMenu()
  game.resumeClockIfClear()
}

useFocusTrap(panel, closePanel, computed(() => ui.saveManagementPanelOpen))

const newSaveLabel = ref('')
async function onCreateSave() {
  const label = newSaveLabel.value.trim()
  if (!label) return
  await createSave(label)
  newSaveLabel.value = ''
}

const renamingId = ref<string | null>(null)
const renameLabel = ref('')
function startRename(id: string, currentLabel?: string) {
  renamingId.value = id
  renameLabel.value = currentLabel ?? ''
}
async function confirmRename() {
  if (!renamingId.value) return
  const label = renameLabel.value.trim()
  if (label) await renameSave(renamingId.value, label)
  renamingId.value = null
}

const pendingDeleteId = ref<string | null>(null)
async function confirmDelete() {
  if (!pendingDeleteId.value) return
  await deleteSave(pendingDeleteId.value)
  pendingDeleteId.value = null
}

const fileInput = ref<HTMLInputElement | null>(null)
const pendingImportFile = ref<File | null>(null)
const importConflict = ref<ImportConflict | null>(null)
const importError = ref<string | null>(null)

function triggerImport() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importError.value = null
  const result = await importSaveFile(file)
  if (result.ok) return
  if (result.reason === 'conflict') {
    pendingImportFile.value = file
    importConflict.value = result.conflict
  } else {
    importError.value = result.error.message
  }
}

async function confirmImportOverwrite() {
  const file = pendingImportFile.value
  importConflict.value = null
  pendingImportFile.value = null
  if (!file) return
  const result = await importSaveFile(file, { confirmOverwrite: true })
  if (!result.ok && result.reason === 'invalid') importError.value = result.error.message
}

function cancelImportOverwrite() {
  importConflict.value = null
  pendingImportFile.value = null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <Transition name="puk-panel">
    <HudPanel
      v-if="ui.saveManagementPanelOpen"
      class="absolute left-1/2 top-24 z-30 max-h-[calc(100vh-7rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto"
      role="dialog"
      aria-modal="false"
      aria-label="Save management panel"
    >
    <div ref="panel" class="contents">
      <PanelHeader title="Saved games" subtitle="Manual slots only">
        <template #actions>
          <IconButton label="Close save management panel" size="sm" @click="closePanel">
            <X class="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </template>
      </PanelHeader>

      <div class="hud-panel-body space-y-4">
        <div class="flex gap-2">
          <input
            v-model="newSaveLabel"
            type="text"
            placeholder="New save name..."
            class="min-w-0 flex-1 rounded-[var(--puk-radius-control)] border border-puk-border bg-puk-surface px-2 py-1.5 text-sm text-puk-text placeholder:text-puk-text-disabled"
            @keydown.enter="onCreateSave"
          />
          <button
            type="button"
            class="hud-action-button hud-action-button--primary shrink-0"
            :disabled="!newSaveLabel.trim()"
            @click="onCreateSave"
          >
            <Save class="h-4 w-4" aria-hidden="true" />
            Save
          </button>
        </div>

        <div class="space-y-2">
          <div v-for="entry in manualSaves" :key="entry.id" class="hud-record px-3 py-2">
            <div v-if="renamingId === entry.id" class="flex gap-2">
              <input
                v-model="renameLabel"
                type="text"
                class="min-w-0 flex-1 rounded-[var(--puk-radius-control)] border border-puk-border bg-puk-surface px-2 py-1 text-sm text-puk-text"
                @keydown.enter="confirmRename"
                @keydown.escape="renamingId = null"
              />
              <button type="button" class="hud-action-button hud-action-button--primary" @click="confirmRename">
                <Save class="h-4 w-4" aria-hidden="true" />
                Save
              </button>
              <button type="button" class="hud-action-button" @click="renamingId = null">Cancel</button>
            </div>
            <template v-else>
              <p class="text-sm font-semibold text-puk-text">{{ entry.label || entry.id }}</p>
              <p class="text-xs text-puk-text-muted">{{ entry.summary }}</p>
              <p class="text-xs text-puk-text-disabled">Updated {{ formatDate(entry.updatedAt) }}</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" class="hud-action-button" @click="overwriteSave(entry.id)">
                  <RotateCcw class="h-4 w-4" aria-hidden="true" />
                  Overwrite
                </button>
                <button type="button" class="hud-action-button" @click="startRename(entry.id, entry.label)">
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                  Rename
                </button>
                <button type="button" class="hud-action-button" @click="exportSave(entry.id)">
                  <Download class="h-4 w-4" aria-hidden="true" />
                  Export
                </button>
                <button type="button" class="hud-action-button hud-action-button--danger" @click="pendingDeleteId = entry.id">
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                  Delete
                </button>
              </div>
            </template>
          </div>

          <p v-if="!manualSaves.length" class="text-sm text-puk-text-disabled">No manual saves yet.</p>
        </div>

        <div class="border-t border-puk-border-subtle pt-3">
          <button type="button" class="hud-action-button" @click="triggerImport">
            <Upload class="h-4 w-4" aria-hidden="true" />
            Import save
          </button>
          <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="onFileSelected" />
          <p v-if="importError" class="mt-2 text-xs text-puk-danger">{{ importError }}</p>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-if="pendingDeleteId"
      title="Delete this save?"
      message="This permanently removes the save slot. This can't be undone."
      confirm-label="Delete"
      @confirm="confirmDelete"
      @cancel="pendingDeleteId = null"
    />

    <ConfirmDialog
      v-if="importConflict"
      title="Overwrite existing save?"
      :message="`A save already exists for this id${importConflict.existing?.label ? ` (${importConflict.existing.label})` : ''}. Importing will overwrite it.`"
      confirm-label="Overwrite"
      @confirm="confirmImportOverwrite"
      @cancel="cancelImportOverwrite"
    />
    </HudPanel>
  </Transition>
</template>
