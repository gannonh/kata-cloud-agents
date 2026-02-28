import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { Layout } from '../../../apps/desktop/src/components/Layout';

function renderLayout(initialEntry = '/', childPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path={childPath} element={<p>child content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  test('renders the selected application shell frame', () => {
    renderLayout();
    expect(screen.getByTestId('desktop-shell-frame')).toBeInTheDocument();
  });

  test('renders main content area', () => {
    renderLayout();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('renders child route content via Outlet', () => {
    renderLayout();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  test('keeps breadcrumbs generic when no desktop route matches', () => {
    renderLayout('/missing', '*');
    const breadcrumbs = screen.getByRole('navigation', { name: /breadcrumbs/i });

    expect(breadcrumbs).toHaveTextContent('Overview');
    expect(breadcrumbs).not.toHaveTextContent('Dashboard');
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
