import type { Contest, ElectionOutcome, ExplanationGroup, ExplanationRecord, ISODate, Party, PartyId } from '@/types'
import type { PollingImpact } from './poll'

function partyName(parties: Party[], partyId: PartyId): string {
  return parties.find((party) => party.id === partyId)?.shortName ?? partyId
}

function impactDetail(impact: PollingImpact): string {
  if (impact.magnitude > 0) return 'Helped this party in the next published poll.'
  if (impact.magnitude < 0) return 'Held this party back in the next published poll.'
  return 'Recorded but had no net direction.'
}

function groupImpacts(id: ExplanationGroup['id'], title: string, summary: string, impacts: PollingImpact[], parties: Party[]): ExplanationGroup {
  return {
    id,
    title,
    summary,
    contributors: impacts.map((impact) => ({
      label: partyName(parties, impact.partyId),
      detail: `${impactDetail(impact)} Source: ${impact.source}.`,
      partyId: impact.partyId,
      magnitude: impact.magnitude,
      sourceId: impact.source,
    })),
  }
}

export function buildPollExplanation(args: {
  id: string
  date: ISODate
  before: Record<PartyId, number>
  after: Record<PartyId, number>
  impacts: PollingImpact[]
  parties: Party[]
}): ExplanationRecord {
  const groups: ExplanationGroup[] = []
  const commitmentImpacts = args.impacts.filter((impact) => impact.source.startsWith('targeting:') || impact.source.startsWith('commitment:'))
  const eventImpacts = args.impacts.filter(
    (impact) => !commitmentImpacts.includes(impact) && impact.source !== 'alignment' && impact.source !== 'variance',
  )
  if (eventImpacts.length) groups.push(groupImpacts('events', 'Events and actions', 'Recorded choices and campaign actions were folded into this release.', eventImpacts, args.parties))
  if (commitmentImpacts.length)
    groups.push(groupImpacts('commitments', 'Local commitments', 'Targeting and contest activity contributed through their recorded campaign effects.', commitmentImpacts, args.parties))
  groups.push({
    id: 'alignment',
    title: 'Policy alignment and salience',
    summary: 'The poll also applies the current issue-salience model, so parties drift toward or away from voters without exposing false precision.',
    contributors: [],
  })
  groups.push({
    id: 'variance',
    title: 'Bounded variance',
    summary: 'A small seeded wobble is included so releases are not perfectly mechanical, but the movement is capped.',
    contributors: [],
  })

  const movers = Object.entries(args.after)
    .map(([partyId, value]) => ({ partyId, delta: value - (args.before[partyId] ?? 0) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map(({ partyId, delta }) => `${partyName(args.parties, partyId)} ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`)

  return {
    id: args.id,
    kind: 'poll',
    title: 'Why did the poll change?',
    summary: movers.length ? `Largest recorded moves: ${movers.join(', ')}.` : 'The poll was recalculated from the current campaign state.',
    date: args.date,
    groups,
  }
}

export function buildContestExplanation(args: {
  id: string
  date: ISODate
  contest: Contest
  actionLabel: string
  resultLabel: string
  impacts: PollingImpact[]
  influenceBonusApplied: boolean
  parties: Party[]
}): ExplanationRecord {
  const groups: ExplanationGroup[] = [
    {
      id: 'events',
      title: 'Contest response',
      summary: `${args.actionLabel} resolved the contest as: ${args.resultLabel}.`,
      contributors: args.impacts.map((impact) => ({
        label: partyName(args.parties, impact.partyId),
        detail: `${impactDetail(impact)} Source: ${impact.source}.`,
        partyId: impact.partyId,
        magnitude: impact.magnitude,
        sourceId: impact.source,
      })),
    },
  ]
  if (args.influenceBonusApplied) {
    groups.push({
      id: 'commitments',
      title: 'Local commitments',
      summary: 'An active targeted campaign in this area added a bounded contest bonus for the acting party.',
      contributors: [],
    })
  }
  groups.push({
    id: 'variance',
    title: 'Bounded variance',
    summary: 'Contest outcomes are narrative and polling-facing here; the underlying seat changes only in scheduled election resolution.',
    contributors: [],
  })

  return {
    id: args.id,
    kind: 'contest',
    title: `Why did ${args.contest.seatName} change?`,
    summary: args.resultLabel,
    date: args.date,
    groups,
  }
}

export function buildElectionExplanation(args: { id: string; outcome: ElectionOutcome; parties: Party[] }): ExplanationRecord {
  const localSeats = args.outcome.winners.filter((winner) => winner.source === 'local-commitment').length
  const swingSeats = args.outcome.winners.filter((winner) => winner.source === 'national-swing').length
  return {
    id: args.id,
    kind: 'election',
    title: 'Why did the election resolve this way?',
    summary: args.outcome.summary,
    date: args.outcome.date,
    groups: [
      {
        id: 'model',
        title: 'Election model',
        summary: args.outcome.provenance,
        contributors: [
          { label: 'National swing', detail: `${swingSeats} seats were assigned by the polling swing model.` },
          { label: 'Local commitments', detail: `${localSeats} seats were decided by accumulated local campaign influence.` },
        ],
      },
      {
        id: 'commitments',
        title: 'Decisive places',
        summary: 'The closest or most consequential seats are shown without implying more precision than the model records.',
        contributors: args.outcome.decisiveSeats.slice(0, 8).map((seat) => ({
          label: seat.seatName,
          detail: `${partyName(args.parties, seat.previousParty)} to ${partyName(args.parties, seat.winnerParty)} via ${seat.source.replaceAll('-', ' ')}.`,
          partyId: seat.winnerParty,
        })),
      },
    ],
  }
}
