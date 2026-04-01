import { describe, expect, it } from 'vitest'
import { appFlowReducer, buildDisconnectSummary, initialAppFlow } from '../lib/appFlow'

// ─── initialAppFlow ────────────────────────────────────────────────────────────

describe('initialAppFlow', () => {
  it('starts on the hero screen', () => {
    expect(initialAppFlow.screen).toBe('hero')
  })

  it('has all fields defaulted to null', () => {
    expect(initialAppFlow.roomId).toBeNull()
    expect(initialAppFlow.username).toBeNull()
    expect(initialAppFlow.activeSignalMode).toBeNull()
    expect(initialAppFlow.matchingStartedAt).toBeNull()
    expect(initialAppFlow.disconnectSummary).toBeNull()
  })
})

// ─── buildDisconnectSummary ────────────────────────────────────────────────────

describe('buildDisconnectSummary', () => {
  it('builds disconnect summaries with the expected payload', () => {
    expect(buildDisconnectSummary({ reason: 'partner_left', matchedInMs: 3200 }).reason).toBe('partner_left')
    expect(buildDisconnectSummary({ durationMs: 120000 }).durationMs).toBe(120000)
  })

  it('defaults reason to "ended"', () => {
    expect(buildDisconnectSummary().reason).toBe('ended')
  })

  it('defaults all fields to null when called with no args', () => {
    const summary = buildDisconnectSummary()
    expect(summary.signalMode).toBeNull()
    expect(summary.matchedInMs).toBeNull()
    expect(summary.durationMs).toBeNull()
    expect(summary.choice).toBeNull()
  })

  it('preserves all passed fields', () => {
    const summary = buildDisconnectSummary({
      reason: 'timeout',
      signalMode: 'midnight',
      matchedInMs: 5000,
      durationMs: 300000,
      choice: 'fade',
    })
    expect(summary.reason).toBe('timeout')
    expect(summary.signalMode).toBe('midnight')
    expect(summary.matchedInMs).toBe(5000)
    expect(summary.durationMs).toBe(300000)
    expect(summary.choice).toBe('fade')
  })
})

// ─── appFlowReducer ───────────────────────────────────────────────────────────

describe('app flow reducer – NAVIGATE', () => {
  it('navigates to a new screen', () => {
    const state = appFlowReducer(initialAppFlow, { type: 'NAVIGATE', screen: 'login' })
    expect(state.screen).toBe('login')
  })

  it('preserves other state fields when navigating', () => {
    const base = { ...initialAppFlow, username: 'stardust' }
    const state = appFlowReducer(base, { type: 'NAVIGATE', screen: 'register' })
    expect(state.username).toBe('stardust')
  })
})

describe('app flow reducer – AUTH_SIGNED_OUT', () => {
  it('resets to initial hero state on sign-out', () => {
    const loggedInState = { ...initialAppFlow, screen: 'chat', username: 'ghost', roomId: 'r1' }
    const state = appFlowReducer(loggedInState, { type: 'AUTH_SIGNED_OUT' })
    expect(state.screen).toBe('hero')
    expect(state.username).toBeNull()
    expect(state.roomId).toBeNull()
  })
})

describe('app flow reducer – AUTH_USERNAME_REQUIRED', () => {
  it('sends user to choose-username and clears room/mode', () => {
    const state = appFlowReducer(
      { ...initialAppFlow, roomId: 'r1', activeSignalMode: 'battery', disconnectSummary: { reason: 'ended' } },
      { type: 'AUTH_USERNAME_REQUIRED' }
    )
    expect(state.screen).toBe('choose-username')
    expect(state.roomId).toBeNull()
    expect(state.activeSignalMode).toBeNull()
    expect(state.disconnectSummary).toBeNull()
  })
})

describe('app flow reducer – AUTH_READY', () => {
  it('sets username and screen when auth is ready', () => {
    const state = appFlowReducer(initialAppFlow, {
      type: 'AUTH_READY',
      username: 'luna',
      screen: 'landing',
      roomId: null,
      signalMode: null,
    })
    expect(state.username).toBe('luna')
    expect(state.screen).toBe('landing')
  })

  it('defaults to landing screen if no screen provided', () => {
    const state = appFlowReducer(initialAppFlow, {
      type: 'AUTH_READY',
      username: 'nova',
    })
    expect(state.screen).toBe('landing')
  })

  it('restores active room if provided', () => {
    const state = appFlowReducer(initialAppFlow, {
      type: 'AUTH_READY',
      username: 'nova',
      screen: 'chat',
      roomId: 'room-xyz',
      signalMode: 'midnight',
    })
    expect(state.roomId).toBe('room-xyz')
    expect(state.activeSignalMode).toBe('midnight')
  })

  it('clears matchingStartedAt and disconnectSummary on auth ready', () => {
    const state = appFlowReducer(
      { ...initialAppFlow, matchingStartedAt: 12345, disconnectSummary: { reason: 'ended' } },
      { type: 'AUTH_READY', username: 'nova' }
    )
    expect(state.matchingStartedAt).toBeNull()
    expect(state.disconnectSummary).toBeNull()
  })
})

describe('app flow reducer – USERNAME_SAVED', () => {
  it('saves username and navigates to landing', () => {
    const state = appFlowReducer(initialAppFlow, { type: 'USERNAME_SAVED', username: 'void_echo' })
    expect(state.username).toBe('void_echo')
    expect(state.screen).toBe('landing')
  })
})

describe('app flow reducer – MATCH_START', () => {
  it('navigates to connecting with signal mode and timestamp', () => {
    const state = appFlowReducer(initialAppFlow, {
      type: 'MATCH_START',
      signalMode: 'battery',
      startedAt: 99999,
    })
    expect(state.screen).toBe('connecting')
    expect(state.activeSignalMode).toBe('battery')
    expect(state.matchingStartedAt).toBe(99999)
    expect(state.disconnectSummary).toBeNull()
  })
})

describe('app flow reducer – MATCH_FOUND', () => {
  it('stores an active room when a match is found', () => {
    const nextState = appFlowReducer(initialAppFlow, {
      type: 'MATCH_FOUND',
      roomId: 'room-123',
      signalMode: 'battery',
    })
    expect(nextState.screen).toBe('chat')
    expect(nextState.roomId).toBe('room-123')
    expect(nextState.activeSignalMode).toBe('battery')
  })

  it('falls back to previous activeSignalMode if none given', () => {
    const base = { ...initialAppFlow, activeSignalMode: 'midnight' }
    const state = appFlowReducer(base, { type: 'MATCH_FOUND', roomId: 'r2' })
    expect(state.activeSignalMode).toBe('midnight')
  })
})

describe('app flow reducer – MATCH_ABORTED', () => {
  it('goes back to landing and clears matchingStartedAt', () => {
    const base = { ...initialAppFlow, screen: 'connecting', matchingStartedAt: 5000 }
    const state = appFlowReducer(base, { type: 'MATCH_ABORTED' })
    expect(state.screen).toBe('landing')
    expect(state.matchingStartedAt).toBeNull()
  })
})

describe('app flow reducer – SESSION_ENDED', () => {
  it('navigates to disconnect and stores summary', () => {
    const summary = buildDisconnectSummary({ reason: 'partner_left' })
    const state = appFlowReducer(
      { ...initialAppFlow, screen: 'chat', roomId: 'r3' },
      { type: 'SESSION_ENDED', summary }
    )
    expect(state.screen).toBe('disconnect')
    expect(state.roomId).toBeNull()
    expect(state.matchingStartedAt).toBeNull()
    expect(state.disconnectSummary.reason).toBe('partner_left')
  })

  it('handles SESSION_ENDED with no summary gracefully', () => {
    const state = appFlowReducer(initialAppFlow, { type: 'SESSION_ENDED' })
    expect(state.screen).toBe('disconnect')
    expect(state.disconnectSummary).toBeNull()
  })
})

describe('app flow reducer – DISCONNECT_RETURNED', () => {
  it('goes back to landing and keeps summary', () => {
    const summary = buildDisconnectSummary({ reason: 'ended', choice: 'fade' })
    const state = appFlowReducer(
      { ...initialAppFlow, screen: 'disconnect', disconnectSummary: summary },
      { type: 'DISCONNECT_RETURNED', summary }
    )
    expect(state.screen).toBe('landing')
    expect(state.disconnectSummary.choice).toBe('fade')
  })

  it('falls back to existing disconnectSummary if none provided', () => {
    const existingSummary = buildDisconnectSummary({ reason: 'timeout' })
    const state = appFlowReducer(
      { ...initialAppFlow, disconnectSummary: existingSummary },
      { type: 'DISCONNECT_RETURNED' }
    )
    expect(state.disconnectSummary.reason).toBe('timeout')
  })
})

describe('app flow reducer – unknown action', () => {
  it('returns unchanged state for unknown action types', () => {
    const state = appFlowReducer(initialAppFlow, { type: 'UNKNOWN_ACTION_THAT_DOES_NOT_EXIST' })
    expect(state).toEqual(initialAppFlow)
  })
})
