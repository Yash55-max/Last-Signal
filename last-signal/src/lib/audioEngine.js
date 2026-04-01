let audioContext = null
let masterGain = null
let staticGain = null
let staticSource = null
let isEnabled = false

function getContext() {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    audioContext = new AudioContextClass()
    masterGain = audioContext.createGain()
    masterGain.gain.value = 0.2
    masterGain.connect(audioContext.destination)
  }
  return audioContext
}

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const output = buffer.getChannelData(0)
  for (let i = 0; i < output.length; i += 1) {
    output[i] = (Math.random() * 2 - 1) * 0.5
  }
  return buffer
}

function createTone(frequency, durationSec, volume = 0.08, type = 'sine') {
  const context = getContext()
  if (!context || !masterGain || !isEnabled) return

  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  gainNode.gain.setValueAtTime(0.0001, now)
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.08)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)

  oscillator.connect(gainNode)
  gainNode.connect(masterGain)
  oscillator.start(now)
  oscillator.stop(now + durationSec + 0.02)
}

export async function resumeAudio() {
  const context = getContext()
  if (context && context.state === 'suspended') {
    await context.resume()
  }
}

export async function setAudioEnabled(nextEnabled) {
  isEnabled = Boolean(nextEnabled)
  if (isEnabled) {
    await resumeAudio()
  } else {
    stopSearchStatic()
  }

  return isEnabled
}

export function startSearchStatic() {
  const context = getContext()
  if (!context || !masterGain || !isEnabled || staticSource) return

  staticGain = context.createGain()
  staticGain.gain.value = 0.0001
  staticGain.connect(masterGain)

  staticSource = context.createBufferSource()
  staticSource.buffer = createNoiseBuffer(context)
  staticSource.loop = true
  staticSource.connect(staticGain)
  staticSource.start()

  staticGain.gain.cancelScheduledValues(context.currentTime)
  staticGain.gain.linearRampToValueAtTime(0.035, context.currentTime + 0.8)
}

export function stopSearchStatic() {
  const context = getContext()
  if (!context || !staticSource || !staticGain) return

  staticGain.gain.cancelScheduledValues(context.currentTime)
  staticGain.gain.linearRampToValueAtTime(0.0001, context.currentTime + 0.4)

  const source = staticSource
  const gain = staticGain
  staticSource = null
  staticGain = null

  setTimeout(() => {
    try {
      source.stop()
      source.disconnect()
      gain.disconnect()
    } catch {
      // Source may already be stopped.
    }
  }, 450)
}

export function playMatchTone() {
  if (!isEnabled) return
  createTone(440, 0.7, 0.06, 'sine')
  createTone(554.37, 0.9, 0.04, 'triangle')
}

export function playWarningPulse() {
  if (!isEnabled) return
  createTone(148, 0.42, 0.05, 'triangle')
}

export function playFadeOutNoise() {
  const context = getContext()
  if (!context || !masterGain || !isEnabled) return

  startSearchStatic()
  masterGain.gain.cancelScheduledValues(context.currentTime)
  masterGain.gain.setValueAtTime(0.2, context.currentTime)
  masterGain.gain.linearRampToValueAtTime(0.01, context.currentTime + 2.8)

  setTimeout(() => {
    stopSearchStatic()
    if (!masterGain || !context) return
    masterGain.gain.cancelScheduledValues(context.currentTime)
    masterGain.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.4)
  }, 2800)
}
