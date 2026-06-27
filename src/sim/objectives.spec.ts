import { describe, expect, it } from 'vitest'
import { evaluateObjectiveRecords, initialiseObjectiveRecords, type ObjectiveEvaluationContext } from './objectives'
import type { CampaignObjective } from '@/types'

function ctx(overrides: Partial<ObjectiveEvaluationContext> = {}): ObjectiveEvaluationContext {
  return {
    date: '2025-01-01',
    selectedPartyId: 'labour',
    polling: { labour: 28 },
    projectedSeatsByParty: { labour: 310 },
    commonsSeatsByParty: { labour: 411 },
    finance: { labour: { estimatedCashOnHand: 100000, source: 'estimated' } },
    membership: { labour: 300000 },
    feed: [],
    electionOutcomes: [],
    campaignArcs: [],
    ...overrides,
  }
}

describe('campaign objectives', () => {
  const objectives: CampaignObjective[] = [
    {
      id: 'poll-30',
      kind: 'optional',
      title: 'Reach 30',
      description: 'Reach 30% polling.',
      success: [{ type: 'polling-at-least', partyId: 'player', value: 30 }],
    },
    {
      id: 'hidden-local-proof',
      kind: 'hidden',
      title: 'Local proof',
      description: 'Unlock from an arc consequence.',
      hiddenUntil: [{ type: 'arc-consequence', consequenceId: 'storm-visited-ground' }],
      success: [{ type: 'arc-consequence', consequenceId: 'storm-visited-ground' }],
    },
  ]

  it('marks an active objective succeeded when its pure condition is met', () => {
    const records = initialiseObjectiveRecords(objectives, ctx())
    const evaluated = evaluateObjectiveRecords(objectives, records, ctx({ polling: { labour: 31 } }))

    expect(evaluated.find((record) => record.objectiveId === 'poll-30')?.status).toBe('succeeded')
  })

  it('keeps hidden objectives unrevealed until their condition appears, then succeeds them', () => {
    const records = initialiseObjectiveRecords(objectives, ctx())
    expect(records.find((record) => record.objectiveId === 'hidden-local-proof')?.availableAt).toBeUndefined()

    const evaluated = evaluateObjectiveRecords(
      objectives,
      records,
      ctx({
        campaignArcs: [
          {
            arcId: 'storm',
            status: 'completed',
            currentStageId: 'choice',
            startedAt: '2025-01-01',
            updatedAt: '2025-02-01',
            completedAt: '2025-02-01',
            consequences: [{ id: 'storm-visited-ground', label: 'Visited', summary: 'Visited the area.' }],
          },
        ],
      }),
    )

    const hidden = evaluated.find((record) => record.objectiveId === 'hidden-local-proof')
    expect(hidden?.availableAt).toBe('2025-01-01')
    expect(hidden?.status).toBe('succeeded')
  })
})
