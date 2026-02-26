import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Bot,
  Package,
  Server,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';

import { useAppStore } from '../store/app';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/specs', label: 'Specs', icon: FileText },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/artifacts', label: 'Artifacts', icon: Package },
  { path: '/fleet', label: 'Fleet', icon: Server },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <nav className={`${collapsed ? 'w-14' : 'w-56'} bg-slate-900 border-r border-slate-800 flex flex-col transition-[width] duration-200`}>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!collapsed && <span className="text-sm font-semibold text-slate-200">Kata Cloud Agents</span>}
        <button
          onClick={toggleSidebar}
          className="text-slate-400 hover:text-slate-200"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'} py-2 text-sm ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
