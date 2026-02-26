import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { Sidebar } from '../../../apps/desktop/src/components/Sidebar';

function renderSidebar(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  test('renders app name', () => {
    renderSidebar();
    expect(screen.getByText('Kata Cloud Agents')).toBeInTheDocument();
  });

  test('renders all navigation items', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /specs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agents/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /artifacts/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /fleet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  test('dashboard link points to root path', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('href', '/');
  });

  test('specs link points to /specs', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /specs/i });
    expect(link).toHaveAttribute('href', '/specs');
  });

  test('active route gets active styling', () => {
    renderSidebar('/specs');
    const specsLink = screen.getByRole('link', { name: /specs/i });
    expect(specsLink.className).toContain('bg-slate-800');
    expect(specsLink.className).toContain('text-white');
  });
});
