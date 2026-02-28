import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test } from 'vitest';

import { Sidebar } from '../../../apps/desktop/src/components/Sidebar';
import { useAppStore } from '../../../apps/desktop/src/store/app';

function renderSidebar(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarCollapsed: false });
  });

  test('labels the desktop shell navigation as primary navigation', () => {
    renderSidebar();
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  });

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

  test('inactive route gets default styling', () => {
    renderSidebar('/specs');
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink.className).toContain('text-slate-400');
    expect(dashboardLink.className).not.toContain('bg-slate-800 text-white');
    expect(dashboardLink.className).toContain('hover:bg-slate-800/50');
  });

  test('hides labels when collapsed', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    expect(screen.queryByText('Kata Cloud Agents')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  test('toggle button collapses and expands sidebar', async () => {
    const user = userEvent.setup();
    renderSidebar();
    expect(screen.getByText('Kata Cloud Agents')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(screen.queryByText('Kata Cloud Agents')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand sidebar/i }));
    expect(screen.getByText('Kata Cloud Agents')).toBeInTheDocument();
  });
});
