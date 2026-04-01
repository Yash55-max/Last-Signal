import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { containsToxic, canSendMessage } from '../lib/moderation'

// ─── containsToxic ─────────────────────────────────────────────────────────────

describe('containsToxic', () => {
    it('returns false for clean messages', () => {
        expect(containsToxic('hello there')).toBe(false)
        expect(containsToxic('how are you doing?')).toBe(false)
        expect(containsToxic('goodnight, signal')).toBe(false)
    })

    it('detects a banned word as a standalone word', () => {
        expect(containsToxic('you are an idiot')).toBe(true)
    })

    it('detects banned words case-insensitively', () => {
        expect(containsToxic('You Are An IDIOT')).toBe(true)
        expect(containsToxic('HATE is never ok')).toBe(true)
    })

    it('does NOT match partial word occurrences (word boundary check)', () => {
        // "kill" inside "skills" should NOT trigger
        expect(containsToxic('I have great skills')).toBe(false)
        // "hate" inside "whatever" should NOT trigger
        expect(containsToxic('whatever you think')).toBe(false)
    })

    it('detects multiple distinct banned words', () => {
        expect(containsToxic('you are such a loser and a creep')).toBe(true)
    })

    it('handles empty string safely', () => {
        expect(containsToxic('')).toBe(false)
    })

    it('handles a string with only spaces', () => {
        expect(containsToxic('   ')).toBe(false)
    })

    it('detects banned word "kys"', () => {
        expect(containsToxic('just kys')).toBe(true)
    })
})

// ─── canSendMessage ─────────────────────────────────────────────────────────────

describe('canSendMessage', () => {
    beforeEach(() => {
        // Fast-forward time by resetting via a single call before each test
        // to avoid rate-limit bleeding across tests.
        // We call canSendMessage once to set lastMessageTime, then advance fake time.
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('allows the first message immediately', () => {
        // Because real timers aren't running and lastMessageTime starts at 0,
        // advancing by a large amount ensures we can send.
        vi.setSystemTime(Date.now() + 5000)
        expect(canSendMessage()).toBe(true)
    })

    it('blocks a second message sent within 800ms', () => {
        // Send first message
        const t0 = Date.now() + 10000
        vi.setSystemTime(t0)
        canSendMessage() // sets lastMessageTime
        // Try again immediately
        vi.setSystemTime(t0 + 100) // only 100ms later
        expect(canSendMessage()).toBe(false)
    })

    it('allows a message after 800ms have passed', () => {
        const t0 = Date.now() + 20000
        vi.setSystemTime(t0)
        canSendMessage() // first send
        vi.setSystemTime(t0 + 800) // exactly 800ms later — NOT less than limit
        expect(canSendMessage()).toBe(true)
    })

    it('blocks quickly repeated calls', () => {
        const t0 = Date.now() + 30000
        vi.setSystemTime(t0)
        canSendMessage()
        vi.setSystemTime(t0 + 1)
        expect(canSendMessage()).toBe(false)
        vi.setSystemTime(t0 + 2)
        expect(canSendMessage()).toBe(false)
    })
})
