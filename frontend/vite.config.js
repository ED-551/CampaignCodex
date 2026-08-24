import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // WebSocket proxy for Socket.io dev server
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      // Uploaded images (maps, tokens, portraits) are served by the API.
      // In production nginx serves this path; dev needs the same route or
      // every uploaded image 404s against the Vite server.
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Individual vendor chunks are well under 500 KB each; raise the global
    // warning limit slightly so we don't get noise on legitimate shared chunks.
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Stable vendor chunks — content-hashed and cached long-term by nginx.
        // Vite 8 / rolldown requires manualChunks to be a function (not an object).
        // Separating vendors means a new app deploy only invalidates the app chunks,
        // not the unchanged React / socket / icon bundles users already have cached.
        manualChunks(id) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi/') || id.includes('node_modules/earcut')) {
            return 'vendor-pixi'
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer') || id.includes('node_modules/idb')) {
            return 'vendor-vtt-state'
          }
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) {
            return 'vendor-socket'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
