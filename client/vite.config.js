import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se redirige al servidor Express (Controlador)
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          deck: ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/geo-layers', '@deck.gl/extensions', '@deck.gl/react'],
          motion: ['gsap']
        }
      }
    }
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
