export const DATA_VIZ_THEME = {
  text: 'var(--puk-color-text)',
  mutedText: 'var(--puk-color-text-muted)',
  disabledText: 'var(--puk-color-text-disabled)',
  gridLine: 'color-mix(in srgb, var(--puk-color-border-subtle) 78%, transparent)',
  axisLine: 'color-mix(in srgb, var(--puk-color-border) 82%, transparent)',
  tooltipBackground: 'color-mix(in srgb, var(--puk-color-surface-raised) 96%, transparent)',
  tooltipBorder: 'var(--puk-color-border)',
  estimatedPattern: 'repeating-linear-gradient(135deg, rgb(244 241 232 / 0.18) 0 2px, transparent 2px 5px)',
} as const

export function formatPercent(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(value)
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function trendDelta(current: number, previous?: number): { label: string; direction: 'up' | 'down' | 'flat' } {
  if (previous == null) return { label: 'new', direction: 'flat' }
  const delta = current - previous
  if (Math.abs(delta) < 0.05) return { label: '0.0', direction: 'flat' }
  return {
    label: `${delta > 0 ? '+' : ''}${formatPercent(delta)}`,
    direction: delta > 0 ? 'up' : 'down',
  }
}
