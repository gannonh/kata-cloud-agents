import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { App as DesktopApp } from '../../apps/desktop/src/App';
import { App as MobileApp } from '../../apps/mobile/src/App';
import { App as WebApp } from '../../apps/web/src/App';

describe('app shells', () => {
  test('renders desktop title', () => {
    render(<DesktopApp />);
    expect(screen.getByRole('heading', { name: 'Kata Cloud Agents (Desktop)' })).toBeInTheDocument();
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
});
