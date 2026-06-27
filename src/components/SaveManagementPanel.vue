<script setup lang="ts">
// In-game save-management surface (P3.1) — manual slots only; the rolling autosave is never
// listed here since it isn't player-managed (spec: P3.2 owns the title-screen "Continue" flow).
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useSaveManagement } from '@/composables/useSaveManagement'
import { useFocusTrap } from '@/composables/useFocusTrap'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
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
  <section
    v-if="ui.saveManagementPanelOpen"
    ref="panel"
    class="absolute left-1/2 top-24 z-30 max-h-[calc(100vh-7rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-zinc-700/70 bg-zinc-950/90 shadow-2xl backdrop-blur-sm"
    role="dialog"
    aria-modal="false"
    aria-label="Save management panel"
  >
    <header class="flex items-start justify-between gap-3 border-b border-zinc-800/80 px-4 py-3">
      <div>
      <p class="text-sm font-semibold tracking-wide text-zinc-100">Saved games</p>
      <p class="text-xs text-zinc-400">Manual slots — the rolling autosave isn't shown here</p>
      </div>
      <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800" @click="closePanel">
        Close
      </button>
    </header>

    <div class="space-y-4 px-4 py-4">
      <div class="flex gap-2">
        <input
          v-model="newSaveLabel"
          type="text"
          placeholder="New save name…"
          class="min-w-0 flex-1 rounded-md border border-zinc-700/70 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500"
          @keydown.enter="onCreateSave"
        />
        <button
          type="button"
          class="shrink-0 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!newSaveLabel.trim()"
          @click="onCreateSave"
        >
          Save
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="entry in manualSaves"
          :key="entry.id"
          class="rounded-lg border border-zinc-800/80 px-3 py-2"
        >
          <div v-if="renamingId === entry.id" class="flex gap-2">
            <input
              v-model="renameLabel"
              type="text"
              class="min-w-0 flex-1 rounded-md border border-zinc-700/70 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              @keydown.enter="confirmRename"
              @keydown.escape="renamingId = null"
            />
            <button type="button" class="rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800" @click="confirmRename">Save</button>
            <button type="button" class="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800" @click="renamingId = null">Cancel</button>
          </div>
          <template v-else>
            <p class="text-sm font-medium text-zinc-100">{{ entry.label || entry.id }}</p>
            <p class="text-xs text-zinc-400">{{ entry.summary }}</p>
            <p class="text-xs text-zinc-500">Updated {{ formatDate(entry.updatedAt) }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button type="button" class="rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800" @click="overwriteSave(entry.id)">Overwrite</button>
              <button type="button" class="rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800" @click="startRename(entry.id, entry.label)">Rename</button>
              <button type="button" class="rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800" @click="exportSave(entry.id)">Export</button>
              <button type="button" class="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-zinc-800" @click="pendingDeleteId = entry.id">Delete</button>
            </div>
          </template>
        </div>

        <p v-if="!manualSaves.length" class="text-sm text-zinc-500">No manual saves yet.</p>
      </div>

      <div class="border-t border-zinc-800/80 pt-3">
        <button type="button" class="rounded-md border border-zinc-700/70 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800" @click="triggerImport">
          Import save…
        </button>
        <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="onFileSelected" />
        <p v-if="importError" class="mt-2 text-xs text-red-400">{{ importError }}</p>
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
      :message="`A save already exists for this id${importConflict.existing?.label ? ` (“${importConflict.existing.label}”)` : ''}. Importing will overwrite it.`"
      confirm-label="Overwrite"
      @confirm="confirmImportOverwrite"
      @cancel="cancelImportOverwrite"
    />
  </section>
</template>
