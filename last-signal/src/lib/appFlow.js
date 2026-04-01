export const initialAppFlow = {
  screen: 'hero',
  roomId: null,
  username: null,
  activeSignalMode: null,
  matchingStartedAt: null,
  disconnectSummary: null,
}

export function buildDisconnectSummary({
  reason = 'ended',
  signalMode = null,
  matchedInMs = null,
  durationMs = null,
  endedAt = null,
  timeOfDay = null,
  messagesCount = null,
  chatTranscript = null,
  choice = null,
} = {}) {
  return {
    reason,
    signalMode,
    matchedInMs,
    durationMs,
    endedAt,
    timeOfDay,
    messagesCount,
    chatTranscript,
    choice,
  }
}

export function appFlowReducer(state, action) {
  switch (action.type) {
    case 'NAVIGATE':
      return {
        ...state,
        screen: action.screen,
      }

    case 'AUTH_SIGNED_OUT':
      return {
        ...initialAppFlow,
        screen: 'hero',
      }

    case 'AUTH_USERNAME_REQUIRED':
      return {
        ...state,
        screen: 'choose-username',
        roomId: null,
        activeSignalMode: null,
        disconnectSummary: null,
      }

    case 'AUTH_READY':
      return {
        ...state,
        username: action.username,
        screen: action.screen || 'landing',
        roomId: action.roomId || null,
        activeSignalMode: action.signalMode || null,
        matchingStartedAt: null,
        disconnectSummary: null,
      }

    case 'USERNAME_SAVED':
      return {
        ...state,
        username: action.username,
        screen: 'landing',
      }

    case 'MATCH_START':
      return {
        ...state,
        screen: 'connecting',
        activeSignalMode: action.signalMode,
        matchingStartedAt: action.startedAt,
        disconnectSummary: null,
      }

    case 'MATCH_FOUND':
      return {
        ...state,
        screen: 'chat',
        roomId: action.roomId,
        activeSignalMode: action.signalMode || state.activeSignalMode,
      }

    case 'MATCH_ABORTED':
      return {
        ...state,
        screen: 'landing',
        matchingStartedAt: null,
      }

    case 'SESSION_ENDED':
      return {
        ...state,
        screen: 'disconnect',
        roomId: null,
        matchingStartedAt: null,
        disconnectSummary: action.summary || null,
      }

    case 'DISCONNECT_RETURNED':
      return {
        ...state,
        screen: 'landing',
        disconnectSummary: action.summary || state.disconnectSummary,
      }

    default:
      return state
  }
}
