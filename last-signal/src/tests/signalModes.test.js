import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIGNAL_MODE,
  SIGNAL_MODES,
  normalizeSignalMode,
  getSignalModeConfig,
  getSessionDuration,
  getSignalAvailability,
} from '../lib/signalModes'

// ─── DEFAULT_SIGNAL_MODE ──────────────────────────────────────────────────────

describe('DEFAULT_SIGNAL_MODE', () => {
  it('is midnight', () => {
    expect(DEFAULT_SIGNAL_MODE).toBe('midnight')
  })
})

// ─── SIGNAL_MODES ─────────────────────────────────────────────────────────────

describe('SIGNAL_MODES', () => {
  it('has battery and midnight keys', () => {
    expect(SIGNAL_MODES).toHaveProperty('battery')
    expect(SIGNAL_MODES).toHaveProperty('midnight')
  })

  it('battery mode has a 3 minute session', () => {
    expect(SIGNAL_MODES.battery.durationMs).toBe(3 * 60 * 1000)
  })

  it('midnight mode has a 5 minute session', () => {
    expect(SIGNAL_MODES.midnight.durationMs).toBe(5 * 60 * 1000)
  })

  it('each mode has required display properties', () => {
    for (const mode of Object.values(SIGNAL_MODES)) {
      expect(mode).toHaveProperty('id')
      expect(mode).toHaveProperty('label')
      expect(mode).toHaveProperty('durationMs')
      expect(mode).toHaveProperty('disconnectTitle')
      expect(mode).toHaveProperty('disconnectBody')
    }
  })
})

// ─── normalizeSignalMode ──────────────────────────────────────────────────────

describe('normalizeSignalMode', () => {
  it('returns battery for battery mode', () => {
    expect(normalizeSignalMode('battery')).toBe('battery')
  })

  it('normalizes unknown modes to midnight', () => {
    expect(normalizeSignalMode('unknown')).toBe(DEFAULT_SIGNAL_MODE)
  })

  it('normalizes null to midnight', () => {
    expect(normalizeSignalMode(null)).toBe(DEFAULT_SIGNAL_MODE)
  })

  it('normalizes undefined to midnight', () => {
    expect(normalizeSignalMode(undefined)).toBe(DEFAULT_SIGNAL_MODE)
  })

  it('normalizes empty string to midnight', () => {
    expect(normalizeSignalMode('')).toBe(DEFAULT_SIGNAL_MODE)
  })

  it('is case-sensitive — "Battery" is not a valid mode', () => {
    expect(normalizeSignalMode('Battery')).toBe(DEFAULT_SIGNAL_MODE)
  })
})

// ─── getSignalModeConfig ──────────────────────────────────────────────────────

describe('getSignalModeConfig', () => {
  it('returns battery config for battery mode', () => {
    const config = getSignalModeConfig('battery')
    expect(config.id).toBe('battery')
    expect(config.durationMs).toBe(180000)
  })

  it('returns midnight config for midnight mode', () => {
    const config = getSignalModeConfig('midnight')
    expect(config.id).toBe('midnight')
    expect(config.label).toContain('midnight')
  })

  it('returns midnight config for unknown mode', () => {
    const config = getSignalModeConfig('foobar')
    expect(config.id).toBe('midnight')
  })

  it('exposes signal mode config metadata', () => {
    expect(getSignalModeConfig('battery').durationMs).toBe(180000)
    expect(getSignalModeConfig('midnight').label).toContain('midnight')
  })
})

// ─── getSessionDuration ───────────────────────────────────────────────────────

describe('getSessionDuration', () => {
  it('returns 3 minutes (180000ms) for battery mode', () => {
    expect(getSessionDuration('battery')).toBe(180000)
  })

  it('returns 5 minutes (300000ms) for midnight mode', () => {
    expect(getSessionDuration('midnight')).toBe(300000)
  })

  it('falls back to midnight duration for unknown mode', () => {
    expect(getSessionDuration('unknown')).toBe(300000)
  })
})

// ─── getSignalAvailability ────────────────────────────────────────────────────

describe('getSignalAvailability – battery trigger', () => {
  it('returns battery availability when battery is low and discharging', () => {
    const availability = getSignalAvailability({
      battery: { supported: true, level: 8, charging: false },
      manualMode: false,
      now: new Date('2026-03-13T19:00:00'),
    })
    expect(availability.isTriggered).toBe(true)
    expect(availability.signalMode).toBe('battery')
    expect(availability.reason).toBe('battery')
  })

  it('triggers battery mode at exactly 10%', () => {
    const availability = getSignalAvailability({
      battery: { supported: true, level: 10, charging: false },
      manualMode: false,
      now: new Date('2026-03-13T15:00:00'),
    })
    expect(availability.isTriggered).toBe(true)
    expect(availability.signalMode).toBe('battery')
  })

  it('does NOT trigger when battery is above 10%', () => {
    const availability = getSignalAvailability({
      battery: { supported: true, level: 50, charging: false },
      manualMode: false,
      now: new Date('2026-03-13T15:00:00'),
    })
    expect(availability.isTriggered).toBe(false)
    expect(availability.signalMode).toBeNull()
  })

  it('does NOT trigger when battery is not supported', () => {
    const availability = getSignalAvailability({
      battery: { supported: false, level: 5, charging: false },
      manualMode: false,
      now: new Date('2026-03-13T15:00:00'),
    })
    expect(availability.isTriggered).toBe(false)
  })

  it('triggers battery mode even when charging (eligible if ≤10%)', () => {
    const availability = getSignalAvailability({
      battery: { supported: true, level: 9, charging: true },
      manualMode: false,
      now: new Date('2026-03-13T15:00:00'),
    })
    // Battery mode is still enabled per the code (batteryEligible doesn't check charging)
    expect(availability.isTriggered).toBe(true)
    expect(availability.signalMode).toBe('battery')
  })
})

describe('getSignalAvailability – midnight trigger', () => {
  it('triggers midnight mode between 12am and 4am', () => {
    const times = ['2026-03-13T00:30:00', '2026-03-13T01:00:00', '2026-03-13T03:59:00']
    for (const time of times) {
      const availability = getSignalAvailability({
        battery: null,
        manualMode: false,
        now: new Date(time),
      })
      expect(availability.isTriggered).toBe(true)
      expect(availability.signalMode).toBe('midnight')
      expect(availability.reason).toBe('midnight')
    }
  })

  it('does NOT trigger midnight at 4am (exclusive)', () => {
    const availability = getSignalAvailability({
      battery: null,
      manualMode: false,
      now: new Date('2026-03-13T04:00:00'),
    })
    expect(availability.isTriggered).toBe(false)
  })

  it('does NOT trigger midnight at noon', () => {
    const availability = getSignalAvailability({
      battery: null,
      manualMode: false,
      now: new Date('2026-03-13T12:00:00'),
    })
    expect(availability.isTriggered).toBe(false)
  })
})

describe('getSignalAvailability – manual mode', () => {
  it('triggers via manual mode outside restricted hours', () => {
    const availability = getSignalAvailability({
      battery: null,
      manualMode: true,
      now: new Date('2026-03-13T14:00:00'),
    })
    expect(availability.isTriggered).toBe(true)
    expect(availability.signalMode).toBe('midnight')
    expect(availability.reason).toBe('manual')
  })
})

describe('getSignalAvailability – inactive state', () => {
  it('returns isTriggered=false and null signalMode when nothing qualifies', () => {
    const availability = getSignalAvailability({
      battery: { supported: true, level: 80, charging: false },
      manualMode: false,
      now: new Date('2026-03-13T15:00:00'),
    })
    expect(availability.isTriggered).toBe(false)
    expect(availability.signalMode).toBeNull()
    expect(availability.reason).toBe('inactive')
  })

  it('includes eligibility info in inactive state', () => {
    const availability = getSignalAvailability({
      battery: { supported: true, level: 80, charging: false },
      manualMode: false,
      now: new Date('2026-03-13T15:00:00'),
    })
    expect(Array.isArray(availability.eligibility)).toBe(true)
    expect(availability.eligibility.length).toBeGreaterThan(0)
  })

  it('handles null battery gracefully', () => {
    const availability = getSignalAvailability({
      battery: null,
      manualMode: false,
      now: new Date('2026-03-13T15:00:00'),
    })
    expect(availability.isTriggered).toBe(false)
    expect(availability.signalMode).toBeNull()
  })

  it('battery priority overrides midnight window', () => {
    // Low battery + midnight window: battery should win
    const availability = getSignalAvailability({
      battery: { supported: true, level: 5, charging: false },
      manualMode: false,
      now: new Date('2026-03-13T01:00:00'),
    })
    expect(availability.signalMode).toBe('battery')
    expect(availability.reason).toBe('battery')
  })
})
