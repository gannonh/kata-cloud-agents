import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpecDetail } from '../../../apps/desktop/src/pages/SpecDetail';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('SpecDetail', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
  });

  it('renders version history panel', async () => {
    render(
      <MemoryRouter initialEntries={['/specs/spec-1']}>
        <Routes>
          <Route path="/specs/:specId" element={<SpecDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Version History')).toBeInTheDocument();
  });
});
