import { Outlet, matchPath, useLocation } from 'react-router-dom';

import { Sidebar } from './Sidebar';
import { routes } from '../routes';

export function Layout() {
  const location = useLocation();
  const activeRoute = routes.find((route) =>
    matchPath({ path: route.path, end: route.end ?? true }, location.pathname),
  );

  return (
    <div data-testid="desktop-shell-frame" className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-slate-800 bg-slate-950/95 px-4">
          <nav
            aria-label="Breadcrumbs"
            className="flex min-w-0 items-center gap-2 text-sm text-slate-400"
          >
            <span className="hidden sm:inline">Overview</span>
            {activeRoute ? (
              <>
                <span aria-hidden="true" className="hidden sm:inline text-slate-600">
                  /
                </span>
                <span className="truncate font-medium text-slate-100">{activeRoute.label}</span>
              </>
            ) : null}
          </nav>
        </header>
        <main className="flex-1 overflow-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
