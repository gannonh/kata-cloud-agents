import { Outlet, matchPath, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@kata/ui/components/ui/button';

import { Sidebar } from './Sidebar';
import { routes } from '../routes';
import { useAppStore } from '../store/app';

export function Layout() {
  const location = useLocation();
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const activeRoute =
    routes.find((route) =>
      matchPath({ path: route.path, end: route.end ?? true }, location.pathname),
    ) ?? routes[0];

  return (
    <div data-testid="desktop-shell-frame" className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
          <div
            aria-hidden="true"
            className="h-4 w-px shrink-0 bg-slate-800"
          />
          <nav
            aria-label="Breadcrumbs"
            className="flex min-w-0 items-center gap-2 text-sm text-slate-400"
          >
            <span className="hidden sm:inline">Overview</span>
            <span aria-hidden="true" className="hidden sm:inline text-slate-600">
              /
            </span>
            <span className="truncate font-medium text-slate-100">{activeRoute.label}</span>
          </nav>
        </header>
        <main className="flex-1 overflow-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
