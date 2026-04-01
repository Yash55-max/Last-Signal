/* eslint-disable no-undef */

/**
 * Firebase Cloud Messaging Service Worker
 *
 * For contributors / local development:
 * Firebase config is injected into this service worker at build time by Vite
 * via the vite.config.js `injectFirebaseConfig` plugin. You do NOT need to
 * edit this file manually. Just fill in your .env file (copy from .env.example).
 *
 * The self.__FIREBASE_CONFIG__ object is replaced during `npm run build`.
 * In development, the SW reads from the injected config automatically.
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

// Config injected by Vite at build time — see vite.config.js
const config = self.__FIREBASE_CONFIG__ || {}

if (config.apiKey) {
  firebase.initializeApp(config)

  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || 'Last Signal'
    const options = {
      body: payload?.notification?.body || 'A new signal is waiting.',
      icon: '/logo-192.png',
      badge: '/favicon.png',
      tag: 'last-signal-background',
    }

    self.registration.showNotification(title, options)
  })
} else {
  console.warn('[firebase-messaging-sw] Firebase config not found. Push notifications will not work.')
}
