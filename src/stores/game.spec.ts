import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './game'
import type { FeedEntry } from '@/types'

describe('useGameStore.resolveFeedAction', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function unactionedEntry(): FeedEntry {
    return {
      id: 'evt-1',
      date: '2025-01-02',
      headline: 'A by-election is called',
      status: 'unactioned',
      actions: [
        { id: 'campaign', label: 'Campaign hard' },
        { id: 'ignore', label: 'Leave it to the local party' },
      ],
    }
  }

  it('marks the entry actioned and records the chosen action + a placeholder effect', () => {
    const game = useGameStore()
    game.feed.push(unactionedEntry())

    game.resolveFeedAction('evt-1', 'campaign')

    const entry = game.feed[0]
    expect(entry.status).toBe('actioned')
    expect(entry.actionTaken).toBe('Campaign hard')
    expect(entry.effect).toBeTruthy()
    expect(entry.actions).toBeUndefined()
  })

  it('does nothing for an unknown entry id', () => {
    const game = useGameStore()
    game.feed.push(unactionedEntry())

    game.resolveFeedAction('does-not-exist', 'campaign')

    expect(game.feed[0].status).toBe('unactioned')
  })

  it('does nothing for an unknown action id', () => {
    const game = useGameStore()
    game.feed.push(unactionedEntry())

    game.resolveFeedAction('evt-1', 'does-not-exist')

    expect(game.feed[0].status).toBe('unactioned')
  })

  it('is a no-op on an already-actioned entry', () => {
    const game = useGameStore()
    const entry = unactionedEntry()
    entry.status = 'actioned'
    entry.actionTaken = 'Already resolved'
    game.feed.push(entry)

    game.resolveFeedAction('evt-1', 'campaign')

    expect(game.feed[0].actionTaken).toBe('Already resolved')
  })
})
