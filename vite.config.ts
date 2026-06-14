/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Vitest owns the TypeScript suites under src/. The Mayhem importer scripts
    // ship node:test suites (scripts/mayhem/*.test.mjs) run via `node --test`,
    // so keep them out of the Vitest run to avoid "no test suite found".
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
