import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/*.test.ts'] },
  cacheDir: './.cache/vitest',
});
