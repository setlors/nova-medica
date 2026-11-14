import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'NOVA MEDICA',
        short_name: 'NOVA',
        description: 'Offline health-monitoring PDA for astronauts (demo prototype)',
        theme_color: '#04121a',
        background_color: '#04121a',
        display: 'standalone',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,woff2,glb,mp3,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // three.js bundle is bigger than the 2 MB default
      },
    }),
  ],
});