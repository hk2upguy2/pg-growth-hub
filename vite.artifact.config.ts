import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Single-file build for sharing a live demo (in-memory routing, no service worker).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_MEMORY_ROUTER': '"1"' },
  build: { outDir: 'dist-artifact' },
})
