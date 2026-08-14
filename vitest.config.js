import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only unit-test files under src/ — the e2e/ directory holds Playwright
    // specs (a different test() API entirely; Vitest must never try to run
    // them, and Playwright must never try to run these).
    include: ['src/**/*.{test,spec}.js'],
    environment: 'node',
  },
});
