import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@kata/agent-runtime': fileURLToPath(
        new URL('../../packages/agent-runtime/src/index.ts', import.meta.url),
      ),
      '@kata/spec-engine': fileURLToPath(
        new URL('../../packages/spec-engine/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
