import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { App } from '../../../apps/desktop/src/App';

describe('desktop app navigation', () => {
  test('renders dashboard as default route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  test.each([
    ['Specs'],
    ['Agents'],
    ['Artifacts'],
    ['Fleet'],
    ['Settings'],
  ])('navigates to %s page', (name) => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: new RegExp(name, 'i') }));
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  });
});
