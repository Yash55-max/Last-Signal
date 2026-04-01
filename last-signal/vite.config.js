import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

/**
 * Custom plugin: injects Firebase config from env variables into the
 * firebase-messaging-sw.js service worker at build time.
 * This avoids hardcoding any secrets into public files.
 */
function injectFirebaseConfigIntoSW(env) {
  return {
    name: 'inject-firebase-config-into-sw',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist', 'firebase-messaging-sw.js')
      if (!fs.existsSync(swPath)) return

      const config = {
        apiKey: env.VITE_FIREBASE_API_KEY || '',
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: env.VITE_FIREBASE_PROJECT_ID || '',
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: env.VITE_FIREBASE_APP_ID || '',
      }

      let swContent = fs.readFileSync(swPath, 'utf-8')
      swContent = swContent.replace(
        'self.__FIREBASE_CONFIG__ || {}',
        JSON.stringify(config)
      )
      fs.writeFileSync(swPath, swContent)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        workbox: {
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
          globIgnores: ['firebase-messaging-sw.js', 'sw.js'],
        },
        includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo-192.png', 'logo-512.png'],
        manifest: {
          name: 'Last Signal',
          short_name: 'LastSignal',
          description: 'Conversations before the signal fades',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'logo-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'logo-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'logo-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      }),
      injectFirebaseConfigIntoSW(env),
    ],
  }
})

