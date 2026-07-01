import { watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useSaveStore } from '@/stores/save'
import { useUiStore } from '@/stores/ui'

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

type CueName = 'panel' | 'save' | 'event' | 'action' | 'warning'

const CUE_FREQUENCIES: Record<CueName, [number, number]> = {
  panel: [420, 520],
  save: [520, 660],
  event: [360, 540],
  action: [480, 600],
  warning: [220, 180],
}

let audioContext: AudioContext | null = null
let wired = false

function getAudioContext() {
  const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextCtor) return null
  audioContext ??= new AudioContextCtor()
  return audioContext
}

function playCue(name: CueName, volume: number) {
  const ctx = getAudioContext()
  if (!ctx || volume <= 0) return
  void ctx.resume()

  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.08), now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
  gain.connect(ctx.destination)

  CUE_FREQUENCIES[name].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator()
    oscillator.type = name === 'warning' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, now + index * 0.055)
    oscillator.connect(gain)
    oscillator.start(now + index * 0.055)
    oscillator.stop(now + 0.18 + index * 0.055)
  })
}

export function usePresentationAudio() {
  if (wired || typeof window === 'undefined') return
  wired = true

  const ui = useUiStore()
  const game = useGameStore()
  const save = useSaveStore()

  const cue = (name: CueName) => {
    if (!ui.presentation.soundEnabled || ui.presentation.reducedSensory) return
    playCue(name, ui.presentation.soundEffectsVolume)
  }

  watch(() => ui.gameMenuOpen || ui.presentationSettingsOpen || ui.saveManagementPanelOpen, (open, previous) => {
    if (open && !previous) cue('panel')
  })

  watch(() => game.feed.length, (count, previous) => {
    if (count > previous) cue('event')
  })

  watch(() => game.feed.at(-1)?.status, (status, previous) => {
    if (status === 'actioned' && previous === 'unactioned') cue('action')
  })

  watch(() => save.lastSavedAt, (savedAt, previous) => {
    if (savedAt && savedAt !== previous) cue('save')
  })

  watch(() => save.lastWriteError, (error) => {
    if (error) cue('warning')
  })
}
