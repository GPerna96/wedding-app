import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  build: { outDir: 'dist', sourcemap: false },
  // In sviluppo le chiamate API vanno al Worker avviato con `wrangler dev`.
  server: { proxy: { '/api': 'http://127.0.0.1:8787', '/media': 'http://127.0.0.1:8787' } },
})
