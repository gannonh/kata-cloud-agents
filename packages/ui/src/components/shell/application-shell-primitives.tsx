import * as React from 'react';

import { cn } from '../../lib/utils';

export type ApplicationShellFrameProps = React.HTMLAttributes<HTMLDivElement>;

// Adapted from the application-shell1 baseline: shared shell frame primitives live in @kata/ui.
export function ApplicationShellFrame({
  className,
  children,
  ...props
}: ApplicationShellFrameProps) {
  return (
    <div
      data-testid="desktop-shell-frame"
      className={cn('flex h-screen bg-slate-950 text-slate-100', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type ApplicationShellHeaderProps = React.HTMLAttributes<HTMLElement>;

export function ApplicationShellHeader({
  className,
  children,
  ...props
}: ApplicationShellHeaderProps) {
  return (
    <header
      className={cn('flex h-16 shrink-0 items-center border-b border-slate-800 bg-slate-950/95 px-4', className)}
      {...props}
    >
      {children}
    </header>
  );
}

export type ApplicationShellMainProps = React.HTMLAttributes<HTMLElement>;

export function ApplicationShellMain({ className, children, ...props }: ApplicationShellMainProps) {
  return (
    <main className={cn('flex-1 overflow-auto bg-slate-950', className)} {...props}>
      {children}
    </main>
  );
}

export interface ApplicationShellBreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  rootLabel?: string;
  items: string[];
}

export function ApplicationShellBreadcrumbs({
  className,
  items,
  rootLabel = 'Overview',
  ...props
}: ApplicationShellBreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumbs"
      className={cn('flex min-w-0 items-center gap-2 text-sm text-slate-400', className)}
      {...props}
    >
      <span className="hidden sm:inline">{rootLabel}</span>
      {items.map((itemLabel, index) => (
        <React.Fragment key={`${itemLabel}-${index.toString()}`}>
          <span aria-hidden="true" className="hidden sm:inline text-slate-600">
            /
          </span>
          <span className="truncate font-medium text-slate-100">{itemLabel}</span>
        </React.Fragment>
      ))}
    </nav>
  );
}
