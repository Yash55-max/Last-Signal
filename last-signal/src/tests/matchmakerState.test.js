import { describe, expect, it } from 'vitest'
import { createEmptyQueues, enqueueOrMatchUser, removeUserFromQueues, normalizeMatchmakerData, MATCHMAKER_MODES } from '../lib/matchmakerState'

// ─── createEmptyQueues ────────────────────────────────────────────────────────

describe('createEmptyQueues', () => {
  it('returns an object with battery and midnight keys', () => {
    const queues = createEmptyQueues()
    expect(queues).toHaveProperty('battery')
    expect(queues).toHaveProperty('midnight')
  })

  it('starts with empty arrays', () => {
    const queues = createEmptyQueues()
    expect(queues.battery).toEqual([])
    expect(queues.midnight).toEqual([])
  })
})

// ─── MATCHMAKER_MODES ─────────────────────────────────────────────────────────

describe('MATCHMAKER_MODES', () => {
  it('contains battery and midnight modes', () => {
    expect(MATCHMAKER_MODES).toContain('battery')
    expect(MATCHMAKER_MODES).toContain('midnight')
    expect(MATCHMAKER_MODES.length).toBe(2)
  })
})

// ─── normalizeMatchmakerData ──────────────────────────────────────────────────

describe('normalizeMatchmakerData', () => {
  it('returns empty queues for empty input', () => {
    const result = normalizeMatchmakerData({})
    expect(result.queues.battery).toEqual([])
    expect(result.queues.midnight).toEqual([])
  })

  it('returns empty queues when called with no arguments', () => {
    const result = normalizeMatchmakerData()
    expect(result.queues.battery).toEqual([])
    expect(result.queues.midnight).toEqual([])
  })

  it('sanitizes battery queue and removes duplicates', () => {
    const result = normalizeMatchmakerData({
      queues: { battery: ['alpha', 'alpha', 'beta'], midnight: [] },
    })
    expect(result.queues.battery).toEqual(['alpha', 'beta'])
  })

  it('removes non-string values from queues', () => {
    const result = normalizeMatchmakerData({
      queues: { battery: [123, 'alpha', null, 'beta'], midnight: [] },
    })
    expect(result.queues.battery).toEqual(['alpha', 'beta'])
  })

  it('handles null/undefined queues gracefully', () => {
    const result = normalizeMatchmakerData({ queues: null })
    expect(result.queues.battery).toEqual([])
  })
})

// ─── removeUserFromQueues ─────────────────────────────────────────────────────

describe('removeUserFromQueues', () => {
  it('removes a user from every queue', () => {
    const queues = removeUserFromQueues({ battery: ['alpha'], midnight: ['alpha', 'beta'] }, 'alpha')
    expect(queues.battery).toEqual([])
    expect(queues.midnight).toEqual(['beta'])
  })

  it('leaves queues unchanged when user is not in any queue', () => {
    const queues = removeUserFromQueues({ battery: ['zeta'], midnight: ['gamma'] }, 'ghost')
    expect(queues.battery).toEqual(['zeta'])
    expect(queues.midnight).toEqual(['gamma'])
  })

  it('handles an empty queues object gracefully', () => {
    const queues = removeUserFromQueues({}, 'someone')
    expect(queues.battery).toEqual([])
    expect(queues.midnight).toEqual([])
  })

  it('removes the user from a queue that has multiple entries', () => {
    const queues = removeUserFromQueues({ battery: ['a', 'b', 'c'], midnight: [] }, 'b')
    expect(queues.battery).toEqual(['a', 'c'])
  })
})

// ─── enqueueOrMatchUser ───────────────────────────────────────────────────────

describe('enqueueOrMatchUser - queuing', () => {
  it('adds a user to the queue when no partner is waiting', () => {
    const result = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'alpha', 'midnight')
    expect(result.partnerUid).toBeNull()
    expect(result.queues.midnight).toEqual(['alpha'])
  })

  it('matches users only within the same mode queue', () => {
    const firstState = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'alpha', 'battery')
    const secondState = enqueueOrMatchUser({ queues: firstState.queues }, 'beta', 'midnight')
    expect(secondState.partnerUid).toBe(null)
    expect(secondState.queues.battery).toEqual(['alpha'])
    expect(secondState.queues.midnight).toEqual(['beta'])
  })

  it('defaults to midnight mode if no mode is given', () => {
    const result = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'alpha')
    expect(result.queues.midnight).toEqual(['alpha'])
    expect(result.mode).toBe('midnight')
  })

  it('normalizes unknown mode to midnight', () => {
    const result = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'alpha', 'unknown_mode')
    expect(result.mode).toBe('midnight')
    expect(result.queues.midnight).toEqual(['alpha'])
  })
})

describe('enqueueOrMatchUser - matching', () => {
  it('matches two users in the same battery queue', () => {
    const first = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'alpha', 'battery')
    const second = enqueueOrMatchUser({ queues: first.queues }, 'beta', 'battery')
    expect(second.partnerUid).toBe('alpha')
    expect(second.queues.battery).toEqual([])
  })

  it('matches two users in the same midnight queue', () => {
    const first = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'user1', 'midnight')
    const second = enqueueOrMatchUser({ queues: first.queues }, 'user2', 'midnight')
    expect(second.partnerUid).toBe('user1')
    expect(second.queues.midnight).toEqual([])
  })

  it('removes the partner from queue after matching', () => {
    const first = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'A', 'battery')
    const second = enqueueOrMatchUser({ queues: first.queues }, 'B', 'battery')
    expect(second.queues.battery).not.toContain('A')
    expect(second.queues.battery).not.toContain('B')
  })

  it('matches first-in-queue when multiple users are waiting', () => {
    // Step 1: 'first' joins empty queue → queued [first]
    const step1 = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'first', 'midnight')
    expect(step1.partnerUid).toBeNull()
    expect(step1.queues.midnight).toEqual(['first'])

    // Step 2: 'second' joins → matches 'first', queue now empty, second is NOT re-queued
    const step2 = enqueueOrMatchUser({ queues: step1.queues }, 'second', 'midnight')
    expect(step2.partnerUid).toBe('first')
    expect(step2.queues.midnight).toEqual([])

    // Step 3: 'joiner' joins empty queue → queued [joiner]
    const step3 = enqueueOrMatchUser({ queues: step2.queues }, 'joiner', 'midnight')
    expect(step3.partnerUid).toBeNull()
    expect(step3.queues.midnight).toEqual(['joiner'])
  })
})

describe('enqueueOrMatchUser – self-match prevention', () => {
  it('does not match a user with themselves', () => {
    const first = enqueueOrMatchUser({ queues: createEmptyQueues() }, 'alpha', 'battery')
    // alpha tries to enter again
    const second = enqueueOrMatchUser({ queues: first.queues }, 'alpha', 'battery')
    expect(second.partnerUid).toBeNull()
    // Should still only be in queue once
    expect(second.queues.battery.filter((u) => u === 'alpha').length).toBe(1)
  })
})