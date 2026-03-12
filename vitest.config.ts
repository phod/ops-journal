import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  test: {
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['**/src/main/**', 'node'],
    ]
  }
})
