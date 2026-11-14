import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Tests of the built package need `pnpm build` first: `pnpm test:built`.
    exclude: [...configDefaults.exclude, 'test/built/**'],
  },
});
