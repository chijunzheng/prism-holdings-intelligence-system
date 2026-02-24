import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['**/.pnpm-store/**', '**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@prism/shared': path.resolve(__dirname, 'shared/src'),
      '@prism/data': path.resolve(__dirname, 'data/index.ts'),
    },
  },
})
