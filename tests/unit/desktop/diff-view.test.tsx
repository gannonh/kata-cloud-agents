import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffView } from '../../../apps/desktop/src/components/DiffView';

describe('DiffView', () => {
  it('renders changed entries with old and new values', () => {
    const entries = [
      { path: 'title', type: 'changed' as const, oldValue: 'Old Title', newValue: 'New Title' },
    ];
    render(<DiffView entries={entries} fromVersion={1} toVersion={2} />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('"Old Title"')).toBeInTheDocument();
    expect(screen.getByText('"New Title"')).toBeInTheDocument();
  });

  it('renders added entries', () => {
    const entries = [
      { path: 'constraints.2', type: 'added' as const, newValue: 'new constraint' },
    ];
    render(<DiffView entries={entries} fromVersion={1} toVersion={2} />);
    expect(screen.getByText('constraints.2')).toBeInTheDocument();
    expect(screen.getByText(/added/i)).toBeInTheDocument();
  });

  it('renders removed entries', () => {
    const entries = [
      { path: 'blockers.0', type: 'removed' as const, oldValue: { id: '123', description: 'stale' } },
    ];
    render(<DiffView entries={entries} fromVersion={1} toVersion={2} />);
    expect(screen.getByText('blockers.0')).toBeInTheDocument();
    expect(screen.getByText(/removed/i)).toBeInTheDocument();
  });

  it('renders empty state for no differences', () => {
    render(<DiffView entries={[]} fromVersion={1} toVersion={2} />);
    expect(screen.getByText(/no differences/i)).toBeInTheDocument();
  });

  it('shows version comparison header', () => {
    render(<DiffView entries={[]} fromVersion={1} toVersion={2} />);
    expect(screen.getByText(/v1.*v2/i)).toBeInTheDocument();
  });
});
