import { DEFAULT_SIGNAL_MODE, normalizeSignalMode } from './signalModes'

export const MATCHMAKER_MODES = ['battery', 'midnight']

export function createEmptyQueues() {
  return {
    battery: [],
    midnight: [],
  }
}

function sanitizeQueue(queue) {
  if (!Array.isArray(queue)) return []

  return queue.filter((value, index) => typeof value === 'string' && queue.indexOf(value) === index)
}

export function normalizeMatchmakerData(data = {}) {
  const rawQueues = data.queues || {}

  return {
    queues: {
      battery: sanitizeQueue(rawQueues.battery),
      midnight: sanitizeQueue(rawQueues.midnight),
    },
  }
}

export function removeUserFromQueues(queues, uid) {
  const nextQueues = createEmptyQueues()

  for (const mode of MATCHMAKER_MODES) {
    nextQueues[mode] = sanitizeQueue(queues?.[mode]).filter((queuedUid) => queuedUid !== uid)
  }

  return nextQueues
}

export function enqueueOrMatchUser(data, uid, mode = DEFAULT_SIGNAL_MODE) {
  const normalizedMode = normalizeSignalMode(mode)
  const normalized = normalizeMatchmakerData(data)
  const queuesWithoutUser = removeUserFromQueues(normalized.queues, uid)
  const queueForMode = queuesWithoutUser[normalizedMode]

  if (queueForMode.length > 0) {
    return {
      mode: normalizedMode,
      partnerUid: queueForMode[0],
      queues: {
        ...queuesWithoutUser,
        [normalizedMode]: queueForMode.slice(1),
      },
    }
  }

  return {
    mode: normalizedMode,
    partnerUid: null,
    queues: {
      ...queuesWithoutUser,
      [normalizedMode]: [...queueForMode, uid],
    },
  }
}
