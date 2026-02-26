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
        'apps/desktop/src/components/Layout.tsx',
        'apps/desktop/src/components/Sidebar.tsx',
        'apps/desktop/src/pages/Dashboard.tsx',
        'apps/desktop/src/pages/Specs.tsx',
        'apps/desktop/src/pages/Agents.tsx',
        'apps/desktop/src/pages/Artifacts.tsx',
        'apps/desktop/src/pages/Fleet.tsx',
        'apps/desktop/src/pages/Settings.tsx',
        'apps/desktop/src/store/app.ts',
        'apps/mobile/src/App.tsx',
        'apps/web/src/App.tsx',
        'packages/ui/src/components/ui/button.tsx',
        'packages/ui/src/lib/utils.ts',
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
