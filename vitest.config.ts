import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests always run in demo mode (no Supabase), even if a .env.local with real keys exists. They must never touch live data.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
