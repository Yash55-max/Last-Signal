const SESSION_HISTORY_KEY = 'last-signal.session-history'
const MAX_HISTORY_ITEMS = 3

function getTimeOfDayLabel(timestampMs) {
  const hours = new Date(timestampMs).getHours()
  if (hours < 5) return 'deep night'
  if (hours < 12) return 'morning'
  if (hours < 17) return 'afternoon'
  if (hours < 21) return 'evening'
  return 'late night'
}

export function readSessionHistory() {
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : []
  } catch {
    return []
  }
}

export function appendSessionHistory(summary = {}) {
  const endedAt = Number.isFinite(summary.endedAt) ? summary.endedAt : Date.now()
  const nextEntry = {
    signalMode: summary.signalMode || 'midnight',
    durationMs: Number.isFinite(summary.durationMs) ? summary.durationMs : 0,
    endedAt,
    timeOfDay: summary.timeOfDay || getTimeOfDayLabel(endedAt),
    messagesCount: Number.isFinite(summary.messagesCount) ? summary.messagesCount : 0,
  }

  const history = [nextEntry, ...readSessionHistory()].slice(0, MAX_HISTORY_ITEMS)

  try {
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Ignore storage write failures (private mode / full storage)
  }

  return history
}

export function clearSessionHistory() {
  try {
    localStorage.removeItem(SESSION_HISTORY_KEY)
  } catch {
    // Ignore storage clear failures.
  }
}
