import {
  LayoutDashboard,
  FileText,
  Bot,
  FolderGit2,
  Package,
  Server,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { matchPath } from 'react-router-dom';

import { Dashboard } from './pages/Dashboard';
import { Specs } from './pages/Specs';
import { SpecDetail } from './pages/SpecDetail';
import { Agents } from './pages/Agents';
import { Artifacts } from './pages/Artifacts';
import { Fleet } from './pages/Fleet';
import { Settings as SettingsPage } from './pages/Settings';
import { Workspaces } from './pages/Workspaces';

export type RouteId =
  | 'dashboard'
  | 'specs'
  | 'spec-detail'
  | 'agents'
  | 'artifacts'
  | 'fleet'
  | 'workspaces'
  | 'settings';

export type NavGroup = 'command-center' | 'admin';

export interface AppRoute {
  id: RouteId;
  path: string;
  icon: LucideIcon;
  component: ComponentType;
  end?: boolean;
  nav?: boolean;
  navGroup?: NavGroup;
  navLabel: string;
  breadcrumbLabel: string;
  breadcrumbParentId?: RouteId;
}

export const routes: AppRoute[] = [
  {
    id: 'dashboard',
    path: '/',
    icon: LayoutDashboard,
    component: Dashboard,
    end: true,
    navGroup: 'command-center',
    navLabel: 'Dashboard',
    breadcrumbLabel: 'Dashboard',
  },
  {
    id: 'specs',
    path: '/specs',
    icon: FileText,
    component: Specs,
    navGroup: 'command-center',
    navLabel: 'Specs',
    breadcrumbLabel: 'Spec Editor',
  },
  {
    id: 'spec-detail',
    path: '/specs/:specId',
    icon: FileText,
    component: SpecDetail,
    nav: false,
    navLabel: 'Spec Detail',
    breadcrumbLabel: 'Spec Detail',
    breadcrumbParentId: 'specs',
  },
  {
    id: 'agents',
    path: '/agents',
    icon: Bot,
    component: Agents,
    navGroup: 'command-center',
    navLabel: 'Agents',
    breadcrumbLabel: 'Agent Monitor',
  },
  {
    id: 'artifacts',
    path: '/artifacts',
    icon: Package,
    component: Artifacts,
    navGroup: 'command-center',
    navLabel: 'Artifacts',
    breadcrumbLabel: 'Artifacts',
  },
  {
    id: 'fleet',
    path: '/fleet',
    icon: Server,
    component: Fleet,
    navGroup: 'command-center',
    navLabel: 'Fleet',
    breadcrumbLabel: 'Fleet',
  },
  {
    id: 'workspaces',
    path: '/workspaces',
    icon: FolderGit2,
    component: Workspaces,
    navGroup: 'command-center',
    navLabel: 'Workspaces',
    breadcrumbLabel: 'Workspaces',
  },
  {
    id: 'settings',
    path: '/settings',
    icon: Settings,
    component: SettingsPage,
    navGroup: 'admin',
    navLabel: 'Settings',
    breadcrumbLabel: 'Settings',
  },
];

const routeById = new Map<RouteId, AppRoute>(routes.map((route) => [route.id, route]));

export const navGroupLabels: Record<NavGroup, string> = {
  'command-center': 'Command Center',
  admin: 'Administration',
};

export const navGroupOrder: NavGroup[] = ['command-center', 'admin'];

export function findRouteByPath(pathname: string): AppRoute | undefined {
  return routes.find((route) =>
    matchPath({ path: route.path, end: route.end ?? true }, pathname),
  );
}

export function getBreadcrumbTrail(pathname: string): AppRoute[] {
  const activeRoute = findRouteByPath(pathname);
  if (!activeRoute) {
    return [];
  }

  const chain: AppRoute[] = [];
  const seen = new Set<RouteId>();
  let currentRoute: AppRoute | undefined = activeRoute;

  while (currentRoute && !seen.has(currentRoute.id)) {
    chain.unshift(currentRoute);
    seen.add(currentRoute.id);
    currentRoute = currentRoute.breadcrumbParentId
      ? routeById.get(currentRoute.breadcrumbParentId)
      : undefined;
  }

  return chain;
}

export function getGroupedNavRoutes(): Array<{ group: NavGroup; routes: AppRoute[] }> {
  const navRoutes = routes.filter((route) => route.nav !== false);

  return navGroupOrder
    .map((group) => ({
      group,
      routes: navRoutes.filter((route) => route.navGroup === group),
    }))
    .filter((entry) => entry.routes.length > 0);
}
