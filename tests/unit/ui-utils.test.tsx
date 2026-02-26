import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { Button } from '../../packages/ui/src/components/ui/button';
import { cn } from '../../packages/ui/src/lib/utils';

describe('ui utils', () => {
  test('cn merges classes and removes tailwind conflicts', () => {
    expect(cn('px-2', 'px-4', 'text-sm')).toContain('px-4');
    expect(cn('px-2', 'px-4', 'text-sm')).not.toContain('px-2');
  });
});

describe('shared button component', () => {
  test('renders default variant/size classes', () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole('button', { name: 'Click' });
    expect(btn.className).toContain('bg-slate-900');
    expect(btn.className).toContain('h-10');
  });

  test('renders outline + small classes and forwards standard props', () => {
    const onClick = vi.fn();
    render(
      <Button size="sm" variant="outline" onClick={onClick}>
        Outline
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Outline' });
    expect(btn.className).toContain('border');
    expect(btn.className).toContain('h-9');
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('forwards refs', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe('Ref Button');
  });
});
