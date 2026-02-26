# KAT-107: Basic Tauri Desktop Window with Navigation Shell

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Tauri desktop app's navigation shell with sidebar, placeholder pages, routing, state management, and file system access.

**Architecture:** The desktop app uses a sidebar layout with React Router `MemoryRouter` for client-side navigation (no URL bar in Tauri). Zustand manages UI state (sidebar collapse). Six placeholder pages render behind a shared layout shell. Tauri's FS plugin provides local file access for future spec editing.

**Tech Stack:** React 18, react-router-dom 6, Zustand 5, Tailwind CSS 3, Lucide React (icons), Tauri 2 FS plugin, Vitest + Testing Library

---

## Pre-flight

Before starting, verify the working tree is clean and on the correct branch:

```bash
cd /Users/gannonhall/dev/kata/kata-cloud-agents.worktrees/wt-a
git checkout -b feature/kat-107-basic-tauri-desktop-window-with-navigation-shell main
```

Verify existing tests pass:

```bash
pnpm test:unit
```

---

### Task 1: Install Dependencies

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `package.json` (root, for @testing-library/user-event)

**Step 1: Install desktop app runtime dependencies**

```bash
pnpm --filter @kata/desktop add react-router-dom zustand lucide-react @tauri-apps/plugin-fs
```

**Step 2: Install desktop app dev dependencies (Tailwind + PostCSS)**

```bash
pnpm --filter @kata/desktop add -D tailwindcss@^3.4.17 postcss autoprefixer
```

**Step 3: Install root test utility**

```bash
pnpm add -D -w @testing-library/user-event
```

**Step 4: Verify install succeeded**

Run: `pnpm --filter @kata/desktop exec -- npx tailwindcss --help | head -1`
Expected: prints tailwindcss version info without error

**Step 5: Commit**

```bash
git add apps/desktop/package.json package.json pnpm-lock.yaml
git commit -m "chore(desktop): add routing, state, styling, and fs dependencies"
```

---

### Task 2: Configure Tailwind CSS

**Files:**
- Create: `apps/desktop/tailwind.config.js`
- Create: `apps/desktop/postcss.config.js`
- Create: `apps/desktop/src/index.css`
- Modify: `apps/desktop/src/main.tsx`

**Step 1: Create Tailwind config**

Create `apps/desktop/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Step 2: Create PostCSS config**

Create `apps/desktop/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 3: Create index.css with Tailwind directives and base styles**

Create `apps/desktop/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-slate-950 text-slate-100;
}
```

**Step 4: Import CSS in main.tsx**

Modify `apps/desktop/src/main.tsx` — add CSS import at the top:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**Step 5: Verify Tailwind processes CSS**

Run: `pnpm --filter @kata/desktop build`
Expected: build succeeds, `dist/` contains CSS with Tailwind utilities

**Step 6: Commit**

```bash
git add apps/desktop/tailwind.config.js apps/desktop/postcss.config.js apps/desktop/src/index.css apps/desktop/src/main.tsx
git commit -m "feat(desktop): configure Tailwind CSS with PostCSS"
```

---

### Task 3: Zustand App Store

**Files:**
- Create: `apps/desktop/src/store/app.ts`
- Create: `tests/unit/desktop/store.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/desktop/store.test.ts`:

```ts
import { describe, expect, test, beforeEach } from 'vitest';

import { useAppStore } from '../../../apps/desktop/src/store/app';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarCollapsed: false });
  });

  test('initializes with sidebar expanded', () => {
    const state = useAppStore.getState();
    expect(state.sidebarCollapsed).toBe(false);
  });

  test('toggleSidebar flips collapsed state', () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);

    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/desktop/store.test.ts`
Expected: FAIL — cannot find module `../../../apps/desktop/src/store/app`

**Step 3: Write minimal implementation**

Create `apps/desktop/src/store/app.ts`:

```ts
import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- tests/unit/desktop/store.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add apps/desktop/src/store/app.ts tests/unit/desktop/store.test.ts
git commit -m "feat(desktop): add Zustand app store with sidebar state"
```

---

### Task 4: Placeholder Page Components

**Files:**
- Create: `apps/desktop/src/pages/Dashboard.tsx`
- Create: `apps/desktop/src/pages/Specs.tsx`
- Create: `apps/desktop/src/pages/Agents.tsx`
- Create: `apps/desktop/src/pages/Artifacts.tsx`
- Create: `apps/desktop/src/pages/Fleet.tsx`
- Create: `apps/desktop/src/pages/Settings.tsx`
- Create: `tests/unit/desktop/pages.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/desktop/pages.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Dashboard } from '../../../apps/desktop/src/pages/Dashboard';
import { Specs } from '../../../apps/desktop/src/pages/Specs';
import { Agents } from '../../../apps/desktop/src/pages/Agents';
import { Artifacts } from '../../../apps/desktop/src/pages/Artifacts';
import { Fleet } from '../../../apps/desktop/src/pages/Fleet';
import { Settings } from '../../../apps/desktop/src/pages/Settings';

describe('placeholder pages', () => {
  test.each([
    ['Dashboard', Dashboard],
    ['Specs', Specs],
    ['Agents', Agents],
    ['Artifacts', Artifacts],
    ['Fleet', Fleet],
    ['Settings', Settings],
  ])('%s page renders heading', (name, Component) => {
    render(<Component />);
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/desktop/pages.test.tsx`
Expected: FAIL — cannot find module `../../../apps/desktop/src/pages/Dashboard`

**Step 3: Write minimal implementation**

Create each page file. All follow the same pattern:

`apps/desktop/src/pages/Dashboard.tsx`:
```tsx
export function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
      <p className="mt-2 text-slate-400">Overview of your cloud agents.</p>
    </div>
  );
}
```

`apps/desktop/src/pages/Specs.tsx`:
```tsx
export function Specs() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Specs</h1>
      <p className="mt-2 text-slate-400">Manage agent specifications.</p>
    </div>
  );
}
```

`apps/desktop/src/pages/Agents.tsx`:
```tsx
export function Agents() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Agents</h1>
      <p className="mt-2 text-slate-400">View and manage running agents.</p>
    </div>
  );
}
```

`apps/desktop/src/pages/Artifacts.tsx`:
```tsx
export function Artifacts() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Artifacts</h1>
      <p className="mt-2 text-slate-400">Browse generated artifacts.</p>
    </div>
  );
}
```

`apps/desktop/src/pages/Fleet.tsx`:
```tsx
export function Fleet() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Fleet</h1>
      <p className="mt-2 text-slate-400">Monitor your agent fleet.</p>
    </div>
  );
}
```

`apps/desktop/src/pages/Settings.tsx`:
```tsx
export function Settings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
      <p className="mt-2 text-slate-400">Configure application settings.</p>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- tests/unit/desktop/pages.test.tsx`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add apps/desktop/src/pages/ tests/unit/desktop/pages.test.tsx
git commit -m "feat(desktop): add placeholder page components for all sections"
```

---

### Task 5: Sidebar Navigation Component

**Files:**
- Create: `apps/desktop/src/components/Sidebar.tsx`
- Create: `tests/unit/desktop/sidebar.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/desktop/sidebar.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { Sidebar } from '../../../apps/desktop/src/components/Sidebar';

function renderSidebar(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  test('renders app name', () => {
    renderSidebar();
    expect(screen.getByText('Kata Cloud Agents')).toBeInTheDocument();
  });

  test('renders all navigation items', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /specs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agents/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /artifacts/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /fleet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  test('dashboard link points to root path', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('href', '/');
  });

  test('specs link points to /specs', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /specs/i });
    expect(link).toHaveAttribute('href', '/specs');
  });

  test('active route gets active styling', () => {
    renderSidebar('/specs');
    const specsLink = screen.getByRole('link', { name: /specs/i });
    expect(specsLink.className).toContain('bg-slate-800');
    expect(specsLink.className).toContain('text-white');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/desktop/sidebar.test.tsx`
Expected: FAIL — cannot find module `../../../apps/desktop/src/components/Sidebar`

**Step 3: Write minimal implementation**

Create `apps/desktop/src/components/Sidebar.tsx`:

```tsx
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- tests/unit/desktop/sidebar.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add apps/desktop/src/components/Sidebar.tsx tests/unit/desktop/sidebar.test.tsx
git commit -m "feat(desktop): add sidebar navigation component with icons"
```

---

### Task 6: Layout Shell Component

**Files:**
- Create: `apps/desktop/src/components/Layout.tsx`
- Create: `tests/unit/desktop/layout.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/desktop/layout.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { Layout } from '../../../apps/desktop/src/components/Layout';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<p>child content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  test('renders navigation sidebar', () => {
    renderLayout();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('renders main content area', () => {
    renderLayout();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('renders child route content via Outlet', () => {
    renderLayout();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/desktop/layout.test.tsx`
Expected: FAIL — cannot find module `../../../apps/desktop/src/components/Layout`

**Step 3: Write minimal implementation**

Create `apps/desktop/src/components/Layout.tsx`:

```tsx
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- tests/unit/desktop/layout.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/desktop/src/components/Layout.tsx tests/unit/desktop/layout.test.tsx
git commit -m "feat(desktop): add layout shell with sidebar and content area"
```

---

### Task 7: App Router Wiring + Update Smoke Test

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `tests/unit/apps-smoke.test.tsx`
- Create: `tests/unit/desktop/navigation.test.tsx`

**Step 1: Write the navigation integration test (failing)**

Create `tests/unit/desktop/navigation.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { App } from '../../../apps/desktop/src/App';

describe('desktop app navigation', () => {
  test('renders dashboard as default route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  test('navigates to Specs page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /specs/i }));
    expect(screen.getByRole('heading', { name: 'Specs' })).toBeInTheDocument();
  });

  test('navigates to Agents page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /agents/i }));
    expect(screen.getByRole('heading', { name: 'Agents' })).toBeInTheDocument();
  });

  test('navigates to Artifacts page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /artifacts/i }));
    expect(screen.getByRole('heading', { name: 'Artifacts' })).toBeInTheDocument();
  });

  test('navigates to Fleet page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /fleet/i }));
    expect(screen.getByRole('heading', { name: 'Fleet' })).toBeInTheDocument();
  });

  test('navigates to Settings page', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /settings/i }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/desktop/navigation.test.tsx`
Expected: FAIL — App still renders the old placeholder `<h1>`

**Step 3: Rewrite App.tsx with router**

Replace `apps/desktop/src/App.tsx` entirely:

```tsx
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
```

**Step 4: Update existing smoke test**

Modify `tests/unit/apps-smoke.test.tsx` — update the desktop test:

Change the desktop test from:
```tsx
  test('renders desktop title', () => {
    render(<DesktopApp />);
    expect(screen.getByRole('heading', { name: 'Kata Cloud Agents (Desktop)' })).toBeInTheDocument();
  });
```

To:
```tsx
  test('renders desktop app with sidebar and dashboard', () => {
    render(<DesktopApp />);
    expect(screen.getByText('Kata Cloud Agents')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
```

**Step 5: Run all tests to verify they pass**

Run: `pnpm test:unit`
Expected: ALL PASS — smoke test updated, navigation tests pass

**Step 6: Run typecheck**

Run: `pnpm --filter @kata/desktop typecheck`
Expected: PASS — no type errors

**Step 7: Commit**

```bash
git add apps/desktop/src/App.tsx tests/unit/apps-smoke.test.tsx tests/unit/desktop/navigation.test.tsx
git commit -m "feat(desktop): wire up MemoryRouter with layout shell and page routes"
```

---

### Task 8: Tauri FS Plugin Setup

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/capabilities/default.json`

This task modifies Rust/Tauri configuration. It cannot be unit-tested in jsdom. Verify with typecheck and build.

**Step 1: Add Rust dependency**

Modify `apps/desktop/src-tauri/Cargo.toml` — add to `[dependencies]`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
```

**Step 2: Register plugin in main.rs**

Replace `apps/desktop/src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Create capabilities config**

Create `apps/desktop/src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "fs:allow-read-dir"
  ]
}
```

**Step 4: Verify Vite build still works (frontend)**

Run: `pnpm --filter @kata/desktop build`
Expected: PASS — frontend build unaffected by Rust changes

**Step 5: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/main.rs apps/desktop/src-tauri/capabilities/default.json
git commit -m "feat(desktop): configure Tauri FS plugin with read/write capabilities"
```

> **Note:** Full Tauri build (`pnpm --filter @kata/desktop tauri:build`) requires Rust toolchain. Run it if Rust is available to verify the plugin compiles. Otherwise, the Rust-side changes will be validated by CI.

---

### Task 9: App Icon and Branding

**Files:**
- Create: `apps/desktop/src-tauri/icons/` (generated files)
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

**Step 1: Generate placeholder icon**

Use Tauri CLI to generate icons from a solid-color placeholder. If `magick` (ImageMagick) is available:

```bash
magick -size 1024x1024 xc:'#1e293b' /tmp/kata-icon.png
pnpm --filter @kata/desktop exec -- tauri icon /tmp/kata-icon.png
```

If ImageMagick is not available, create a 1024x1024 PNG manually or use any placeholder image, then run:

```bash
pnpm --filter @kata/desktop exec -- tauri icon /path/to/source.png
```

This generates all required icon sizes in `apps/desktop/src-tauri/icons/`.

**Step 2: Update tauri.conf.json with icon paths**

Modify `apps/desktop/src-tauri/tauri.conf.json` — update the `bundle.icon` array:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Kata Cloud Agents",
  "version": "0.1.0",
  "identifier": "sh.kata.cloudagents",
  "build": {
    "beforeDevCommand": "pnpm --filter @kata/desktop dev",
    "beforeBuildCommand": "pnpm --filter @kata/desktop build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Kata Cloud Agents",
        "width": 1200,
        "height": 800
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src-tauri/icons/ apps/desktop/src-tauri/tauri.conf.json
git commit -m "feat(desktop): add placeholder app icon and branding"
```

---

### Task 10: Update Vitest Coverage Config

**Files:**
- Modify: `vitest.config.ts`

**Step 1: Add new source files to coverage includes**

Modify `vitest.config.ts` — update the `coverage.include` array to add the new desktop source files:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'apps/desktop/src/App.tsx',
        'apps/desktop/src/components/Layout.tsx',
        'apps/desktop/src/components/Sidebar.tsx',
        'apps/desktop/src/pages/Dashboard.tsx',
        'apps/desktop/src/pages/Specs.tsx',
        'apps/desktop/src/pages/Agents.tsx',
        'apps/desktop/src/pages/Artifacts.tsx',
        'apps/desktop/src/pages/Fleet.tsx',
        'apps/desktop/src/pages/Settings.tsx',
        'apps/desktop/src/store/app.ts',
        'apps/mobile/src/App.tsx',
        'apps/web/src/App.tsx',
        'packages/ui/src/components/ui/button.tsx',
        'packages/ui/src/lib/utils.ts',
      ],
      exclude: ['**/*.d.ts'],
      thresholds: {
        lines: 99,
        functions: 99,
        statements: 99,
        branches: 95,
        perFile: true,
      },
    },
  },
});
```

Note: `apps/desktop/src/store/app.ts` is included since it can be fully tested. The Tauri FS utilities are excluded since they depend on Tauri runtime.

**Step 2: Run full test suite with coverage**

Run: `pnpm coverage`
Expected: ALL PASS, all files meet coverage thresholds

**Step 3: Run full check suite**

Run: `pnpm check`
Expected: lint, typecheck, and test all pass

**Step 4: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: update vitest coverage config for new desktop components"
```

---

## Final Verification

After all tasks complete:

```bash
pnpm check          # lint + typecheck + test
pnpm coverage       # verify coverage thresholds
pnpm --filter @kata/desktop build   # verify production build
```

All three must pass before creating the PR.

---

## File Summary

**New files (14):**
- `apps/desktop/tailwind.config.js`
- `apps/desktop/postcss.config.js`
- `apps/desktop/src/index.css`
- `apps/desktop/src/store/app.ts`
- `apps/desktop/src/components/Layout.tsx`
- `apps/desktop/src/components/Sidebar.tsx`
- `apps/desktop/src/pages/Dashboard.tsx`
- `apps/desktop/src/pages/Specs.tsx`
- `apps/desktop/src/pages/Agents.tsx`
- `apps/desktop/src/pages/Artifacts.tsx`
- `apps/desktop/src/pages/Fleet.tsx`
- `apps/desktop/src/pages/Settings.tsx`
- `apps/desktop/src-tauri/capabilities/default.json`
- `tests/unit/desktop/` (3 test files: `store.test.ts`, `pages.test.tsx`, `sidebar.test.tsx`, `layout.test.tsx`, `navigation.test.tsx`)

**Modified files (6):**
- `apps/desktop/package.json` (new dependencies)
- `apps/desktop/src/main.tsx` (CSS import)
- `apps/desktop/src/App.tsx` (router wiring)
- `apps/desktop/src-tauri/Cargo.toml` (FS plugin)
- `apps/desktop/src-tauri/src/main.rs` (plugin registration)
- `apps/desktop/src-tauri/tauri.conf.json` (icon paths)
- `tests/unit/apps-smoke.test.tsx` (updated desktop assertion)
- `vitest.config.ts` (coverage includes)
- `package.json` (root, user-event dep)
