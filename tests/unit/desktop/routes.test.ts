import { describe, expect, test } from 'vitest';

import { routes } from '../../../apps/desktop/src/routes';

describe('desktop route metadata', () => {
  test('all navigable routes expose nav and breadcrumb metadata', () => {
    for (const route of routes.filter((item) => item.nav !== false)) {
      expect(route.navLabel).toBeTruthy();
      expect(route.breadcrumbLabel).toBeTruthy();
      expect(route.navGroup).toBeTruthy();
    }
  });

  test('spec detail route is excluded from nav and chains breadcrumbs to specs', () => {
    const specDetailRoute = routes.find((route) => route.id === 'spec-detail');

    expect(specDetailRoute).toBeDefined();
    expect(specDetailRoute?.nav).toBe(false);
    expect(specDetailRoute?.breadcrumbParentId).toBe('specs');
  });
});
