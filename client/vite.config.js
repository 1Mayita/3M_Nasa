import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Reparto de paquetes en chunks estables: cada uno se cachea por separado en el hosting.
// Los .css se dejan fuera para que el CSS de Leaflet no arrastre su chunk JS a la entrada.
function manualChunks(id) {
  if (id.indexOf('node_modules') < 0 || /\.css($|\?)/.test(id)) return undefined;
  if (/node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return 'react';
  if (/node_modules[\/]gsap[\/]/.test(id)) return 'gsap';
  if (/node_modules[\/](@deck\.gl|@luma\.gl|@loaders\.gl|@math\.gl|@probe\.gl|@mapbox|@danmarshall|@turf|earcut|h3-js|supercluster|kdbush|long|mjolnir\.js|gl-matrix|wgsl_reflect)[\/]/.test(id)) return 'deck';
  if (/node_modules[\/](leaflet|react-leaflet|@react-leaflet|@geoman-io)[\/]/.test(id)) return 'leaflet';
  return undefined;
}

// En desarrollo, /api se redirige al servidor Express (Controlador)
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: { manualChunks }
    }
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
