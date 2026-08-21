import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /**
         * Route-level `React.lazy` in App.tsx already keeps three/gsap out of the entry
         * chunk. These rules buy two further things:
         *
         *  - Cacheability. `three` is ~600 KB that never changes; without this it would be
         *    bundled into the home-page chunk and re-downloaded on every content edit.
         *  - A guarantee for @react-pdf/renderer. It is reachable from two different portal
         *    pages, so Rollup would otherwise duplicate it into both -- and it drags in the
         *    yoga layout engine. Before this work it shipped in the single entry chunk to
         *    every home-page visitor.
         *
         * react/react-dom and framer-motion are deliberately NOT split out: they are needed
         * on every route anyway, and hoisting React into its own chunk risks
         * module-initialisation-order surprises for a marginal win.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/three/')) return 'three'
          if (id.includes('/gsap/') || id.includes('/lenis/')) return 'scroll'
          if (id.includes('@react-pdf') || id.includes('/yoga')) return 'pdf'
          if (id.includes('@radix-ui')) return 'radix'
        },
      },
    },
  },
})
