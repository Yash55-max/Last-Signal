import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import app, { db } from './firebase'

let hasRegisteredForegroundListener = false

function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function ensureNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function notifyMatchFound(signalMode = 'midnight') {
  if (!notificationsSupported()) return false
  if (Notification.permission !== 'granted') return false
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false

  const body = signalMode === 'battery'
    ? 'Emergency channel found. Open Last Signal before the battery gives out.'
    : 'A midnight channel just opened. Tap to rejoin the airwaves.'

  const notification = new Notification('Last Signal: match found', {
    body,
    icon: '/logo-192.png',
    badge: '/favicon.png',
    tag: 'last-signal-match',
    renotify: true,
  })

  notification.onclick = () => {
    window.focus()
    notification.close()
  }

  return true
}

async function getMessagingModule() {
  if (!app || typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  try {
    const messagingModule = await import('firebase/messaging')
    const supported = await messagingModule.isSupported()
    if (!supported) return null
    return messagingModule
  } catch {
    return null
  }
}

export async function registerPushForUser(uid) {
  if (!uid || !db) return null

  const permission = await ensureNotificationPermission()
  if (permission !== 'granted') return null

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) return null

  const messagingModule = await getMessagingModule()
  if (!messagingModule) return null

  try {
    // Look for existing PWA service worker registration first
    let registration = await navigator.serviceWorker.getRegistration()
    
    // If no registration found (unlikely in dev/prod with PWA enabled), attempt to register
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js')
    }

    const messaging = messagingModule.getMessaging(app)
    const token = await messagingModule.getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (!token) return null

    await setDoc(doc(db, 'users', uid), {
      push: {
        token,
        updatedAt: serverTimestamp(),
      },
    }, { merge: true })

    if (!hasRegisteredForegroundListener) {
      hasRegisteredForegroundListener = true
      messagingModule.onMessage(messaging, (payload) => {
        const title = payload?.notification?.title || 'Last Signal'
        const body = payload?.notification?.body || 'A signal event just arrived.'

        if (Notification.permission === 'granted') {
          const incoming = new Notification(title, {
            body,
            icon: '/logo-192.png',
            tag: 'last-signal-fcm',
          })

          incoming.onclick = () => {
            window.focus()
            incoming.close()
          }
        }
      })
    }

    return token
  } catch {
    return null
  }
}
