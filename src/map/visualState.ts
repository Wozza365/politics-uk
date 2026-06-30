import type { MapOverlayKey } from '@/stores/ui'

export interface MapOverlayVisual {
  color: string
  label: string
  cue: string
  strokeDasharray?: string
  strokeWidth: number
}

export const MAP_OVERLAY_VISUALS: Record<MapOverlayKey, MapOverlayVisual> = {
  commitments: {
    color: 'var(--puk-color-player-focus)',
    label: 'Your campaigns',
    cue: 'solid rail',
    strokeWidth: 2.4,
  },
  opponentActivity: {
    color: 'var(--puk-color-opponent)',
    label: 'Opponent activity',
    cue: 'dotted rail',
    strokeDasharray: '0.5 1.6',
    strokeWidth: 2.2,
  },
  contests: {
    color: 'var(--puk-color-contest)',
    label: 'Active contests',
    cue: 'dashed rail',
    strokeDasharray: '4 1.8',
    strokeWidth: 2.6,
  },
}

export function overlayVisual(key: MapOverlayKey): MapOverlayVisual {
  return MAP_OVERLAY_VISUALS[key]
}
