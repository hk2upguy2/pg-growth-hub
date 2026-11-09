import { defineConfig, devices } from '@playwright/test'

// Builds the app in demo mode (no Supabase, so tests can never touch live data) and drives it in a real browser.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4399', trace: 'retain-on-failure' },
  webServer: {
    command: 'VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4399',
    url: 'http://localhost:4399', reuseExistingServer: false, timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 900 } }, grepInvert: /@phone/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
})
