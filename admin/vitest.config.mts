import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Pure logic and source guards only: nothing here needs a browser or the database
export default defineConfig({
  resolve: { alias: { '@': path.resolve(dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
