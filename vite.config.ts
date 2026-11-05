/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Path dasar di GitHub Pages (https://<user>.github.io/<repo>/) diisi workflow lewat BASE_PATH.
// Lokal cukup "/".
const base = process.env.BASE_PATH ?? '/'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Pengguna diberi tahu saat ada versi baru, agar tidak memuat ulang di tengah mengisi.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon-64x64.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'Qawwam',
        short_name: 'Qawwam',
        description:
          'Pengatur hidup pribadi: hari, tugas per peran, tidur, mutaba’ah, tentir, dan uang. Bekerja offline, tersinkron antar perangkat.',
        lang: 'id',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#0d0e10',
        background_color: '#0d0e10',
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Semua aset aplikasi disimpan di cache agar bisa dibuka tanpa internet.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/dev/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
    alias: {
      // Modul virtual PWA hanya ada saat build; di tes diganti tiruan.
      'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/pwa-register-mock.ts', import.meta.url)),
    },
  },
})
