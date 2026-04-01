import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties } from 'firebase/analytics'
import app from './firebase'

const DEBUG_BUFFER_KEY = 'last-signal.analytics-buffer'
let analyticsPromise

function recordDebugEvent(name, params) {
  if (typeof window === 'undefined') return

  try {
    const existing = JSON.parse(window.localStorage.getItem(DEBUG_BUFFER_KEY) || '[]')
    const next = [
      {
        name,
        params,
        createdAt: new Date().toISOString(),
      },
      ...existing,
    ].slice(0, 40)

    window.localStorage.setItem(DEBUG_BUFFER_KEY, JSON.stringify(next))
  } catch {
    // Ignore localStorage failures in private or locked-down environments.
  }
}

function sanitizeParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null))
}

async function getAnalyticsInstance() {
  if (typeof window === 'undefined' || !app) return null

  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(app) : null))
      .catch(() => null)
  }

  return analyticsPromise
}

export async function trackEvent(name, params = {}) {
  const cleanedParams = sanitizeParams(params)
  recordDebugEvent(name, cleanedParams)

  const analytics = await getAnalyticsInstance()
  if (analytics) {
    logEvent(analytics, name, cleanedParams)
  }
}

export async function identifyUser(userId, properties = {}) {
  const analytics = await getAnalyticsInstance()
  if (!analytics || !userId) return

  setUserId(analytics, userId)
  const cleanedProperties = sanitizeParams(properties)
  if (Object.keys(cleanedProperties).length > 0) {
    setUserProperties(analytics, cleanedProperties)
  }
}
