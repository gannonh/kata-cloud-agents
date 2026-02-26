import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'apps/desktop/src/App.tsx',
        'apps/mobile/src/App.tsx',
        'apps/web/src/App.tsx',
        'packages/ui/src/components/ui/button.tsx',
        'packages/ui/src/lib/utils.ts'
      ],
      exclude: ['**/*.d.ts'],
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
