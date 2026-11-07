import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' – działa zarówno na GitHub Pages (podkatalog), jak i Cloudflare Pages / własnej domenie
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'gear.svg', 'logo-ss-pwr.jpg'],
      manifest: {
        name: 'Kulturka – Komisja Kultury i Projektów SS PWr',
        short_name: 'Kulturka',
        description: 'Aplikacja Komisji Kultury i Projektów Samorządu Studenckiego PWr',
        lang: 'pl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F9FC',
        theme_color: '#7DC9EE',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        navigateFallbackDenylist: [/^\/auth/],
      },
    }),
  ],
  server: { port: 5173, host: true },
});
