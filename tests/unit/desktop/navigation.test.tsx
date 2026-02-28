import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { App } from '../../../apps/desktop/src/App';

describe('desktop app navigation', () => {
  test('renders dashboard as default route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  test('renders breadcrumb scaffolding for the active route', () => {
    render(<App />);
    const breadcrumbs = screen.getByRole('navigation', { name: /breadcrumbs/i });
    expect(breadcrumbs).toBeInTheDocument();
    expect(breadcrumbs).toHaveTextContent('Overview');
    expect(breadcrumbs).toHaveTextContent('Dashboard');
  });

  test.each([
    ['Specs'],
    ['Agents'],
    ['Artifacts'],
    ['Fleet'],
    ['Workspaces'],
    ['Settings'],
  ])('navigates to %s page', (name) => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: new RegExp(name, 'i') }));
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name })).toBeInTheDocument();
  });

  test('uses long breadcrumb label for Specs route', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /specs/i }));

    const breadcrumbs = screen.getByRole('navigation', { name: /breadcrumbs/i });
    expect(breadcrumbs).toHaveTextContent('Spec Editor');
    expect(breadcrumbs).not.toHaveTextContent('Overview / Specs');
  });

  test('builds breadcrumb parent chain for spec detail route', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /specs/i }));
    fireEvent.click(screen.getByRole('link', { name: /open spec detail/i }));

    const breadcrumbs = screen.getByRole('navigation', { name: /breadcrumbs/i });
    expect(breadcrumbs).toHaveTextContent('Spec Editor');
    expect(breadcrumbs).toHaveTextContent('Spec Detail');
  });
});
