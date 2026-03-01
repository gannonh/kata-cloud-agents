// biome-ignore lint/correctness/noUnusedImports: React must be in scope for JSX
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { App as DesktopApp } from '../../apps/desktop/src/App';
import { App as MobileApp } from '../../apps/mobile/src/App';
import { App as WebApp } from '../../apps/web/src/App';
import { initRealtime as initDesktopRealtime } from '../../apps/desktop/src/realtime';
import { initRealtime as initMobileRealtime } from '../../apps/mobile/src/realtime';
import { initRealtime as initWebRealtime } from '../../apps/web/src/realtime';

describe('app shells', () => {
  test('renders desktop app with sidebar and workspaces', () => {
    render(<DesktopApp />);
    expect(screen.getByText('Kata Cloud Agents')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Workspaces' })).toBeInTheDocument();
  });

  test('renders mobile title', () => {
    render(<MobileApp />);
    expect(screen.getByRole('heading', { name: 'Kata Cloud Agents (Mobile)' })).toBeInTheDocument();
  });

  test('renders web title and shared ui button text', () => {
    render(<WebApp />);
    expect(screen.getByRole('heading', { name: 'Kata Cloud Agents (Web)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shared UI works' })).toBeInTheDocument();
  });

  test('initializes realtime client bootstrap for all apps', () => {
    expect(() => initDesktopRealtime()).not.toThrow();
    expect(() => initMobileRealtime()).not.toThrow();
    expect(() => initWebRealtime()).not.toThrow();
  });
});
