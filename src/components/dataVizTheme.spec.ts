import { describe, expect, it } from 'vitest'
import { formatCompactNumber, formatPercent, trendDelta } from './dataVizTheme'

describe('data visualisation format helpers', () => {
  it('formats percentages with UK numeric punctuation', () => {
    expect(formatPercent(28)).toBe('28.0')
    expect(formatPercent(28.37)).toBe('28.4')
  })

  it('summarises compact quantities for dense tiles', () => {
    expect(formatCompactNumber(6658)).toBe('6.7k')
  })

  it('labels trend direction without relying on colour alone', () => {
    expect(trendDelta(30.2, 28.8)).toEqual({ label: '+1.4', direction: 'up' })
    expect(trendDelta(28.2, 28.8)).toEqual({ label: '-0.6', direction: 'down' })
    expect(trendDelta(28.81, 28.8)).toEqual({ label: '0.0', direction: 'flat' })
  })
})
