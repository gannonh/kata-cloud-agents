import {
  LayoutDashboard,
  FileText,
  Bot,
  Package,
  Server,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { Dashboard } from './pages/Dashboard';
import { Specs } from './pages/Specs';
import { SpecDetail } from './pages/SpecDetail';
import { Agents } from './pages/Agents';
import { Artifacts } from './pages/Artifacts';
import { Fleet } from './pages/Fleet';
import { Settings as SettingsPage } from './pages/Settings';

export interface AppRoute {
  path: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
  end?: boolean;
  nav?: boolean;
}

export const routes: AppRoute[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, component: Dashboard, end: true },
  { path: '/specs', label: 'Specs', icon: FileText, component: Specs },
  { path: '/specs/:specId', label: 'Spec Detail', icon: FileText, component: SpecDetail, nav: false },
  { path: '/agents', label: 'Agents', icon: Bot, component: Agents },
  { path: '/artifacts', label: 'Artifacts', icon: Package, component: Artifacts },
  { path: '/fleet', label: 'Fleet', icon: Server, component: Fleet },
  { path: '/settings', label: 'Settings', icon: Settings, component: SettingsPage },
];
