import {
  ApplicationShellBreadcrumbs,
  ApplicationShellFrame,
  ApplicationShellHeader,
  ApplicationShellMain,
} from '@kata/ui';
import { Outlet, useLocation } from 'react-router-dom';

import { Sidebar } from './Sidebar';
import { getBreadcrumbTrail } from '../routes';

export function Layout() {
  const location = useLocation();
  const breadcrumbTrail = getBreadcrumbTrail(location.pathname).map((route) => route.breadcrumbLabel);

  return (
    <ApplicationShellFrame>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ApplicationShellHeader>
          <ApplicationShellBreadcrumbs items={breadcrumbTrail} />
        </ApplicationShellHeader>
        <ApplicationShellMain>
          <Outlet />
        </ApplicationShellMain>
      </div>
    </ApplicationShellFrame>
  );
}
