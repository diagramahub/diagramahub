import { defineConfig } from 'vitest/config';

// Unit tests for pure utilities (no DOM rendering, no network).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
