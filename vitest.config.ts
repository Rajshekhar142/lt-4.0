import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 1. Tell Vitest only to run unit/integration tests and ignore Playwright files
    include: ['lib/__tests__/**/*.{test,spec}.ts', 'src/__tests__/**/*.{test,spec}.ts'],
    exclude: ['e2e/**', 'node_modules/**'],

    // 2. Prevent SQLite race conditions across test files
    fileParallelism: false,
    maxWorkers: 1,
  },
});