/* eslint-disable no-undef */

/**
 * NOTE: This file is not used in production.
 * The active service worker is firebase-messaging-sw.js.
 * This file is kept as a reference/archive only.
 *
 * Firebase config keys have been removed. See .env.example for required variables.
 */

// Firebase Cloud Messaging Logic (reference only)
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

// Config injected at build time
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
}

// Simple caching for PWA features
self.addEventListener('install', (_event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
