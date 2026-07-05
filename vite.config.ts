import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/routine/',
  plugins: [
    react(),
    VitePWA({
      // Silent auto-update in P1; the "Update available" toast arrives in P4.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Regimen',
        short_name: 'Regimen',
        description: 'Rules-driven skincare routine generator and tracker',
        theme_color: '#00C2CB',
        background_color: '#f2f2f7',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/routine/',
        start_url: '/routine/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole app shell; weather is the only network call and
        // has its own cache — the app must work with zero network.
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        navigateFallback: '/routine/index.html',
      },
    }),
  ],
})
