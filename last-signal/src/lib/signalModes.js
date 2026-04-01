export const DEFAULT_SIGNAL_MODE = 'midnight'

export const SIGNAL_MODES = {
  battery: {
    id: 'battery',
    durationMs: 3 * 60 * 1000,
    label: 'emergency channel',
    iconLabel: '⚡ emergency channel',
    statusLabel: 'emergency signal',
    accentText: 'text-amber-400/70',
    accentSolid: 'text-amber-500',
    accentDot: 'bg-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.45)]',
    scanGlow: 'via-amber-400/30',
    description: 'phone about to die. say the important part first.',
    disconnectTitle: 'connection lost',
    disconnectBody: 'the battery gave out before the silence did',
    reconnectCopy: 'the channel is unstable',
  },
  midnight: {
    id: 'midnight',
    durationMs: 5 * 60 * 1000,
    label: 'midnight channel',
    iconLabel: '🌙 midnight channel',
    statusLabel: 'night airwaves open',
    accentText: 'text-blue-400/70',
    accentSolid: 'text-blue-500',
    accentDot: 'bg-blue-500/70 shadow-[0_0_12px_rgba(59,130,246,0.4)]',
    scanGlow: 'via-blue-500/30',
    description: 'the late window is open. listen while the static is kind.',
    disconnectTitle: 'signal faded',
    disconnectBody: 'the moment becomes memory',
    reconnectCopy: 'the night signal is drifting',
  },
}

export function normalizeSignalMode(mode) {
  return mode === 'battery' ? 'battery' : DEFAULT_SIGNAL_MODE
}

export function getSignalModeConfig(mode) {
  return SIGNAL_MODES[normalizeSignalMode(mode)]
}

export function getSessionDuration(mode) {
  return getSignalModeConfig(mode).durationMs
}

export function getSignalAvailability({ battery, manualMode, now = new Date() }) {
  const hour = now.getHours()
  const isMidnightWindow = hour >= 0 && hour < 4
  const batteryLevel = Number.isFinite(battery?.level) ? battery.level : null
  const batteryPercent = batteryLevel === null ? null : Math.round(batteryLevel)
  const batteryEligible = Boolean(battery?.supported && batteryPercent !== null && batteryPercent <= 10)

  if (batteryEligible) {
    return {
      isTriggered: true,
      signalMode: 'battery',
      reason: 'battery',
      title: 'signal available now',
      detail: `battery at ${batteryPercent}% and falling`,
      eligibility: [
        `battery: ${batteryPercent}%`,
        battery?.charging ? 'charging: yes (still eligible)' : 'charging: no',
        'window: emergency access',
      ],
    }
  }

  if (isMidnightWindow) {
    return {
      isTriggered: true,
      signalMode: 'midnight',
      reason: 'midnight',
      title: 'signal available now',
      detail: 'the midnight airwaves are open until 4am',
      eligibility: [
        'time: 12am to 4am',
        batteryPercent === null ? 'battery: unavailable' : `battery: ${batteryPercent}%`,
        'window: open',
      ],
    }
  }

  if (manualMode) {
    return {
      isTriggered: true,
      signalMode: 'midnight',
      reason: 'manual',
      title: 'signal available now',
      detail: 'developer bypass is holding the channel open',
      eligibility: [
        'mode: manual bypass',
        batteryPercent === null ? 'battery: unavailable' : `battery: ${batteryPercent}%`,
        'window: forced open',
      ],
    }
  }

  const hoursUntilMidnight = hour < 24 ? (24 - hour) % 24 : 0
  const nextWindowText = hour < 4 ? 'available again tonight at 12am' : `opens again in ${hoursUntilMidnight || 24}h`

  return {
    isTriggered: false,
    signalMode: null,
    reason: 'inactive',
    title: 'no signal detected',
    detail: nextWindowText,
    eligibility: [
      batteryPercent === null ? 'battery trigger unavailable on this device' : `battery trigger: ${batteryPercent}% / needs 10% or less`,
      battery?.charging ? 'charging state does not block battery trigger' : 'charging state does not block battery trigger',
      'late-night trigger: 12am to 4am',
    ],
  }
}
