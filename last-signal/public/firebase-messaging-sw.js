/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCQJDbk1iCP1lCDxwbGuSu9EaeK26zfWG0',
  authDomain: 'last-signal-605b1.firebaseapp.com',
  projectId: 'last-signal-605b1',
  storageBucket: 'last-signal-605b1.firebasestorage.app',
  messagingSenderId: '472315684675',
  appId: '1:472315684675:web:b4895cb80f8060fcb5f1f6',
})

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
