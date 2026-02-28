import { NavLink } from 'react-router-dom';
import { FolderGit2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@kata/ui/components/ui/button';

import { useAppStore } from '../store/app';
import { getGroupedNavRoutes, navGroupLabels } from '../routes';

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const groupedNav = getGroupedNavRoutes().map((entry) => ({
    ...entry,
    routes: entry.routes.filter((route) => route.id !== 'workspaces'),
  }));

  return (
    <nav
      aria-label="Primary"
      className={`${collapsed ? 'w-14' : 'w-56'} bg-slate-900 border-r border-slate-800 flex flex-col transition-[width] duration-200`}
    >
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!collapsed && <span className="text-sm font-semibold text-slate-200">Kata Cloud Agents</span>}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto py-2">
        {groupedNav.map(({ group, routes }) => (
          <section key={group}>
            {!collapsed ? (
              <h2 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {navGroupLabels[group]}
              </h2>
            ) : null}
            {routes.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                title={collapsed ? item.navLabel : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'} py-2 text-sm ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.navLabel}
              </NavLink>
            ))}
          </section>
        ))}
        <section>
          {!collapsed ? (
            <h2 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Workspaces
            </h2>
          ) : null}
          <NavLink
            to="/workspaces"
            title={collapsed ? 'Workspaces' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'} py-2 text-sm ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`
            }
          >
            <FolderGit2 className="h-4 w-4 shrink-0" />
            {!collapsed && 'Workspaces'}
          </NavLink>
        </section>
      </div>
    </nav>
  );
}
