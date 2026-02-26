import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Bot,
  Package,
  Server,
  Settings,
  type LucideIcon,
} from 'lucide-react';

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
  return (
    <nav className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <span className="text-sm font-semibold text-slate-200">Kata Cloud Agents</span>
      </div>
      <div className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 text-sm ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
