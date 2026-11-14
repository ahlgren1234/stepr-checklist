import { defineConfig } from 'vitest/config';

// Runs the demo and README examples against the built package in dist/.
// Requires `pnpm build`.
export default defineConfig({
  test: {
    include: ['test/built/**/*.test.ts'],
    environment: 'jsdom',
  },
});
