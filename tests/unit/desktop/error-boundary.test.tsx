import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { ErrorBoundary } from '../../../apps/desktop/src/components/ErrorBoundary';

function ThrowingComponent(): React.ReactNode {
  throw new Error('test error');
}

describe('ErrorBoundary', () => {
  test('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>child content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  test('renders fallback when child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('test error')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
