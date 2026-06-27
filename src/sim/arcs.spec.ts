import { describe, expect, it } from 'vitest'
import { applyArcChoice, initialiseArcRecords } from './arcs'
import type { CampaignArc } from '@/types'

describe('campaign arcs', () => {
  const arcs: CampaignArc[] = [
    {
      id: 'storm',
      title: 'Storm',
      description: 'Storm response arc.',
      startsAtStageId: 'choice',
      stages: [
        {
          id: 'choice',
          title: 'Choice',
          summary: 'Choose a response.',
          branches: [
            {
              eventId: 'storm-event',
              actionId: 'visit',
              closesArc: true,
              consequence: { id: 'visited', label: 'Visited', summary: 'The visit becomes the story.' },
            },
          ],
        },
      ],
    },
  ]

  it('records the matching branch consequence and completes one-shot arcs', () => {
    const records = initialiseArcRecords(arcs, '2025-01-01').map((record) => ({ ...record, status: 'active' as const }))
    const updated = applyArcChoice(arcs, records, 'storm-event', 'visit', '2025-02-01')

    expect(updated[0].status).toBe('completed')
    expect(updated[0].completedAt).toBe('2025-02-01')
    expect(updated[0].consequences).toEqual([{ id: 'visited', label: 'Visited', summary: 'The visit becomes the story.' }])
  })

  it('ignores unrelated event choices', () => {
    const records = initialiseArcRecords(arcs, '2025-01-01').map((record) => ({ ...record, status: 'active' as const }))
    const updated = applyArcChoice(arcs, records, 'other-event', 'visit', '2025-02-01')

    expect(updated).toEqual(records)
  })
})
