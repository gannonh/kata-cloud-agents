import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { Layout } from './components/Layout';
import { NotFound } from './pages/NotFound';
import { routes } from './routes';

export function App() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<Layout />}>
          {routes.map((r) => (
            <Route key={r.path} path={r.path} element={<r.component />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
