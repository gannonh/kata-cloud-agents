import { describe, expect, test, beforeEach } from 'vitest';

import { useAppStore } from '../../../apps/desktop/src/store/app';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarCollapsed: false });
  });

  test('initializes with sidebar expanded', () => {
    const state = useAppStore.getState();
    expect(state.sidebarCollapsed).toBe(false);
  });

  test('toggleSidebar flips collapsed state', () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);

    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });
});
