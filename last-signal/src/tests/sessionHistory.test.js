import { describe, expect, it, beforeEach, vi } from 'vitest'
import { readSessionHistory, appendSessionHistory, clearSessionHistory } from '../lib/sessionHistory'

describe('sessionHistory', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  describe('readSessionHistory', () => {
    it('returns empty array when no history exists', () => {
      localStorage.getItem.mockReturnValue(null)
      expect(readSessionHistory()).toEqual([])
    })

    it('returns parsed history when it exists', () => {
      const mockData = [
        { signalMode: 'midnight', durationMs: 60000, endedAt: 12345, timeOfDay: 'late night', messagesCount: 5 }
      ]
      localStorage.getItem.mockReturnValue(JSON.stringify(mockData))
      expect(readSessionHistory()).toEqual(mockData)
    })

    it('handles invalid JSON gracefully', () => {
      localStorage.getItem.mockReturnValue('invalid-json')
      expect(readSessionHistory()).toEqual([])
    })

    it('only returns up to MAX_HISTORY_ITEMS (3)', () => {
      const longHistory = [
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
      ]
      localStorage.getItem.mockReturnValue(JSON.stringify(longHistory))
      const result = readSessionHistory()
      expect(result.length).toBe(3)
      expect(result).toEqual(longHistory.slice(0, 3))
    })
  })

  describe('appendSessionHistory', () => {
    it('creates a valid history entry with defaults', () => {
      localStorage.getItem.mockReturnValue(null)
      const now = Date.now()
      const result = appendSessionHistory({})
      
      expect(result.length).toBe(1)
      expect(result[0].signalMode).toBe('midnight')
      expect(result[0].durationMs).toBe(0)
      expect(result[0].messagesCount).toBe(0)
      expect(result[0].endedAt).toBeGreaterThanOrEqual(now)
      expect(typeof result[0].timeOfDay).toBe('string')
    })

    it('prepends the new entry to existing history', () => {
      const oldEntry = { signalMode: 'battery', durationMs: 100 }
      localStorage.getItem.mockReturnValue(JSON.stringify([oldEntry]))
      
      const result = appendSessionHistory({ signalMode: 'midnight' })
      expect(result.length).toBe(2)
      expect(result[0].signalMode).toBe('midnight')
      expect(result[1].signalMode).toBe('battery')
    })

    it('truncates history to maximum 3 items when prepending', () => {
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 1 }, { id: 2 }, { id: 3 }
      ]))
      
      const result = appendSessionHistory({ signalMode: 'new' })
      expect(result.length).toBe(3)
      expect(result[0].signalMode).toBe('new')
      expect(result[1].id).toBe(1)
      expect(result[2].id).toBe(2)
    })

    it('saves the updated history to localStorage', () => {
      localStorage.getItem.mockReturnValue(null)
      appendSessionHistory({ signalMode: 'test' })
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'last-signal.session-history',
        expect.stringContaining('"signalMode":"test"')
      )
    })
  })

  describe('clearSessionHistory', () => {
    it('removes the history key from localStorage', () => {
      clearSessionHistory()
      expect(localStorage.removeItem).toHaveBeenCalledWith('last-signal.session-history')
    })
  })
})
