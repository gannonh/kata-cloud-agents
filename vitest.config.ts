import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const uiButtonPath = fileURLToPath(new URL('./packages/ui/src/components/ui/button.tsx', import.meta.url));
const uiUtilsPath = fileURLToPath(new URL('./packages/ui/src/lib/utils.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@kata/ui/components/ui/button': uiButtonPath,
      '@kata/ui/lib/utils': uiUtilsPath,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'apps/desktop/src/**/*.{ts,tsx}',
        'apps/mobile/src/App.tsx',
        'apps/web/src/App.tsx',
        'packages/ui/src/**/*.{ts,tsx}',
      ],
      exclude: ['**/*.d.ts', '**/main.tsx'],
      thresholds: {
        lines: 99,
        functions: 99,
        statements: 99,
        branches: 95,
        perFile: true
      }
    }
  }
});
