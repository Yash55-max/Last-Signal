import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
    })
  ],
})

