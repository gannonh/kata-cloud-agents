import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { App } from '../../../apps/desktop/src/App';

describe('desktop app navigation', () => {
  test('renders dashboard as default route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  test('navigates to Specs page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /specs/i }));
    expect(screen.getByRole('heading', { name: 'Specs' })).toBeInTheDocument();
  });

  test('navigates to Agents page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /agents/i }));
    expect(screen.getByRole('heading', { name: 'Agents' })).toBeInTheDocument();
  });

  test('navigates to Artifacts page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /artifacts/i }));
    expect(screen.getByRole('heading', { name: 'Artifacts' })).toBeInTheDocument();
  });

  test('navigates to Fleet page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /fleet/i }));
    expect(screen.getByRole('heading', { name: 'Fleet' })).toBeInTheDocument();
  });

  test('navigates to Settings page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /settings/i }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});
