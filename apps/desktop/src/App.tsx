import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Specs } from './pages/Specs';
import { Agents } from './pages/Agents';
import { Artifacts } from './pages/Artifacts';
import { Fleet } from './pages/Fleet';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/specs" element={<Specs />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/artifacts" element={<Artifacts />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
