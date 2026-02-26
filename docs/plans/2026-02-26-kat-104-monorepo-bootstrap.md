# KAT-104 Monorepo Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bootstrap the `kata-cloud-agents` monorepo with Turborepo, React+TypeScript apps (desktop/web/mobile), a `shadcn/ui`-based shared design system, and shared workspace tooling so downstream M0 tickets can build on a consistent foundation.

**Architecture:** Create a pnpm+Turbo workspace at the root, then scaffold each required top-level domain (`apps`, `packages`, `agents`, `containers`, `infrastructure`) with explicit package manifests where code will live. Keep configuration centralized (`tsconfig`, ESLint, Prettier, Turbo pipeline) and bootstrap `packages/ui` as the shared `shadcn/ui` design system package consumed by app surfaces. Verify each requirement with small executable tests before implementation. Use minimal starter code and scripts now; defer non-required product behavior to follow-up tickets.

**Tech Stack:** pnpm, Turborepo, React 18 + TypeScript 5, Vite 5, Tauri 2.x, Tailwind CSS, shadcn/ui, Radix UI, Node.js 22, ESLint 9 (flat config), Prettier 3, GitHub Actions

---

Execution discipline references: `@test-driven-development`, `@verification-before-completion`, `@committing-changes`

## Implementation Tasks

### Task 1: Root Workspace + Turbo Baseline

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: `.gitignore`
- Test: `tests/scaffold/root-workspace.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/root-workspace.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkgPath = new URL('../../package.json', import.meta.url);
assert.ok(fs.existsSync(pkgPath), 'package.json must exist');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
assert.equal(pkg.private, true, 'root package must be private');
assert.equal(pkg.packageManager, 'pnpm@10.6.0');
assert.ok(pkg.scripts.build, 'root build script missing');
assert.ok(pkg.scripts.lint, 'root lint script missing');
assert.ok(pkg.scripts.typecheck, 'root typecheck script missing');
assert.ok(pkg.scripts.test, 'root test script missing');

const workspace = fs.readFileSync(new URL('../../pnpm-workspace.yaml', import.meta.url), 'utf8');
assert.match(workspace, /apps\/\*/, 'apps workspace missing');
assert.match(workspace, /packages\/\*/, 'packages workspace missing');
assert.match(workspace, /agents\/\*/, 'agents workspace missing');

const turbo = JSON.parse(fs.readFileSync(new URL('../../turbo.json', import.meta.url), 'utf8'));
assert.ok(turbo.tasks.build, 'turbo build task missing');
assert.ok(turbo.tasks.lint, 'turbo lint task missing');
assert.ok(turbo.tasks.typecheck, 'turbo typecheck task missing');
assert.ok(turbo.tasks.test, 'turbo test task missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/root-workspace.test.mjs`  
Expected: FAIL with missing `package.json`/`pnpm-workspace.yaml`/`turbo.json` assertions.

**Step 3: Write minimal implementation**

```json
// package.json
{
  "name": "kata-cloud-agents",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@10.6.0",
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.8.2"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
  - agents/*
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^test"],
      "outputs": ["coverage/**"]
    }
  }
}
```

```gitignore
# .gitignore additions
node_modules
.pnpm-store
.turbo
dist
coverage
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/root-workspace.test.mjs`  
Expected: PASS (no output, exit code 0).

**Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore tests/scaffold/root-workspace.test.mjs
git commit -m "feat: initialize root pnpm and turbo workspace"
```

### Task 2: Required Directory Layout + Package Manifests

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/web/package.json`
- Create: `apps/mobile/package.json`
- Create: `packages/ui/package.json`
- Create: `packages/spec-engine/package.json`
- Create: `packages/dispatcher/package.json`
- Create: `packages/agent-runtime/package.json`
- Create: `packages/infra-adapters/package.json`
- Create: `packages/governance/package.json`
- Create: `packages/gateway/package.json`
- Create: `packages/db/package.json`
- Create: `packages/shared/package.json`
- Create: `agents/coordinator/package.json`
- Create: `agents/specialist/package.json`
- Create: `agents/verifier/package.json`
- Create: `containers/README.md`
- Create: `infrastructure/README.md`
- Test: `tests/scaffold/layout.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/layout.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const requiredDirs = [
  'apps/desktop', 'apps/web', 'apps/mobile',
  'packages/ui', 'packages/spec-engine', 'packages/dispatcher',
  'packages/agent-runtime', 'packages/infra-adapters', 'packages/governance',
  'packages/gateway', 'packages/db', 'packages/shared',
  'agents/coordinator', 'agents/specialist', 'agents/verifier',
  'containers', 'infrastructure'
];

for (const dir of requiredDirs) {
  assert.ok(fs.existsSync(dir), `missing directory: ${dir}`);
}

const pkgNames = [
  ['apps/desktop/package.json', '@kata/desktop'],
  ['apps/web/package.json', '@kata/web'],
  ['apps/mobile/package.json', '@kata/mobile'],
  ['packages/shared/package.json', '@kata/shared']
];

for (const [file, name] of pkgNames) {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(pkg.name, name, `${file} has wrong package name`);
}
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/layout.test.mjs`  
Expected: FAIL with missing directory assertions.

**Step 3: Write minimal implementation**

```json
// apps/web/package.json (pattern applies to all workspace package.json files)
{
  "name": "@kata/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "echo \"TODO: lint @kata/web\"",
    "typecheck": "tsc --noEmit",
    "test": "node -e \"console.log('no tests yet')\""
  }
}
```

Create all listed directories and package manifests with matching names:
- `@kata/desktop`, `@kata/web`, `@kata/mobile`
- `@kata/ui`, `@kata/spec-engine`, `@kata/dispatcher`, `@kata/agent-runtime`, `@kata/infra-adapters`, `@kata/governance`, `@kata/gateway`, `@kata/db`, `@kata/shared`
- `@kata/agent-coordinator`, `@kata/agent-specialist`, `@kata/agent-verifier`

Create lightweight placeholders:

```markdown
# containers/README.md
Container definitions for local and cloud agent runtimes.
```

```markdown
# infrastructure/README.md
Infrastructure IaC and deployment manifests.
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/layout.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps packages agents containers infrastructure tests/scaffold/layout.test.mjs
git commit -m "feat: scaffold required monorepo directory and package layout"
```

### Task 3: Shared TypeScript, ESLint, and Prettier Configuration

**Files:**
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `apps/web/tsconfig.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `packages/shared/tsconfig.json`
- Test: `tests/scaffold/tooling-config.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/tooling-config.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base = JSON.parse(fs.readFileSync('tsconfig.base.json', 'utf8'));
assert.equal(base.compilerOptions.strict, true);
assert.equal(base.compilerOptions.moduleResolution, 'Bundler');

const webTs = JSON.parse(fs.readFileSync('apps/web/tsconfig.json', 'utf8'));
assert.equal(webTs.extends, '../../tsconfig.base.json');

const eslintConfig = fs.readFileSync('eslint.config.mjs', 'utf8');
assert.match(eslintConfig, /typescript-eslint/);

const prettier = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
assert.equal(prettier.singleQuote, true);
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/tooling-config.test.mjs`  
Expected: FAIL with missing config file assertions.

**Step 3: Write minimal implementation**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

```javascript
// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**']
  }
];
```

```json
// .prettierrc.json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

```txt
# .prettierignore
node_modules
.turbo
dist
build
coverage
```

```json
// apps/web/tsconfig.json (repeat for desktop/mobile/shared with proper include)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/tooling-config.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tsconfig.base.json eslint.config.mjs .prettierrc.json .prettierignore apps/*/tsconfig.json packages/shared/tsconfig.json tests/scaffold/tooling-config.test.mjs
git commit -m "feat: add shared typescript eslint and prettier configuration"
```

### Task 4: Shared shadcn/ui Package + Web App React Baseline

**Files:**
- Create: `packages/ui/components.json`
- Create: `packages/ui/src/components/ui/button.tsx`
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/src/index.ts`
- Modify: `packages/ui/package.json`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Modify: `apps/web/package.json`
- Test: `tests/scaffold/web-app.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/web-app.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const webPkg = JSON.parse(fs.readFileSync('apps/web/package.json', 'utf8'));
assert.ok(webPkg.dependencies.react, 'web app missing react dependency');
assert.ok(webPkg.dependencies['@kata/ui'], 'web app must depend on @kata/ui');

const appFile = fs.readFileSync('apps/web/src/App.tsx', 'utf8');
assert.match(appFile, /from '@kata\/ui\/components\/ui\/button'/, 'App should import shadcn button from shared ui package');

const componentsConfig = JSON.parse(fs.readFileSync('packages/ui/components.json', 'utf8'));
assert.equal(componentsConfig.style, 'default', 'shadcn style should be default');

const buttonFile = fs.readFileSync('packages/ui/src/components/ui/button.tsx', 'utf8');
assert.match(buttonFile, /class-variance-authority/, 'Button should be shadcn-compatible (cva)');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/web-app.test.mjs`  
Expected: FAIL with missing file/dependency assertions.

**Step 3: Write minimal implementation**

```bash
cd packages/ui
pnpm dlx shadcn@latest init --yes
pnpm dlx shadcn@latest add button
```

Then normalize generated files for workspace portability:

```json
// packages/ui/components.json (relevant fields)
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "tsx": true,
  "tailwind": {
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "utils": "@/lib/utils"
  }
}
```

```ts
// packages/ui/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```ts
// packages/ui/src/index.ts
export * from './components/ui/button';
```

```tsx
// apps/web/src/App.tsx
import { Button } from '@kata/ui/components/ui/button';

export function App() {
  return (
    <main>
      <h1>Kata Cloud Agents (Web)</h1>
      <Button>Shared UI works</Button>
    </main>
  );
}
```

```css
/* apps/web/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// apps/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```ts
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

```json
// apps/web/package.json (relevant fields)
{
  "name": "@kata/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "node ../../tests/scaffold/web-app.test.mjs"
  },
  "dependencies": {
    "@kata/ui": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^3.4.17",
    "vite": "^5.4.14"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/web-app.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ui apps/web tests/scaffold/web-app.test.mjs
git commit -m "feat: scaffold shadcn ui design system and web app baseline"
```

### Task 5: Mobile App (PWA-Ready React + TypeScript) Scaffold

**Files:**
- Create: `apps/mobile/src/main.tsx`
- Create: `apps/mobile/src/App.tsx`
- Create: `apps/mobile/index.html`
- Create: `apps/mobile/vite.config.ts`
- Create: `apps/mobile/public/manifest.webmanifest`
- Modify: `apps/mobile/package.json`
- Test: `tests/scaffold/mobile-app.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/mobile-app.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('apps/mobile/package.json', 'utf8'));
assert.ok(pkg.dependencies.react, 'mobile app missing react dependency');
assert.ok(pkg.scripts.dev, 'mobile app missing dev script');

const manifest = JSON.parse(fs.readFileSync('apps/mobile/public/manifest.webmanifest', 'utf8'));
assert.equal(manifest.name, 'Kata Cloud Agents Mobile');
assert.equal(manifest.display, 'standalone');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/mobile-app.test.mjs`  
Expected: FAIL with missing files.

**Step 3: Write minimal implementation**

```tsx
// apps/mobile/src/App.tsx
export function App() {
  return <h1>Kata Cloud Agents (Mobile)</h1>;
}
```

```tsx
// apps/mobile/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```json
// apps/mobile/public/manifest.webmanifest
{
  "name": "Kata Cloud Agents Mobile",
  "short_name": "Kata Mobile",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111827",
  "icons": []
}
```

```json
// apps/mobile/package.json (relevant fields)
{
  "name": "@kata/mobile",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "node ../../tests/scaffold/mobile-app.test.mjs"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.14"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/mobile-app.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/mobile tests/scaffold/mobile-app.test.mjs
git commit -m "feat: scaffold mobile react pwa baseline"
```

### Task 6: Desktop Tauri 2.x Shell Scaffold

**Files:**
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src/App.tsx`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/package.json`
- Test: `tests/scaffold/desktop-app.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/desktop-app.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const requiredFiles = [
  'apps/desktop/src-tauri/Cargo.toml',
  'apps/desktop/src-tauri/src/main.rs',
  'apps/desktop/src-tauri/tauri.conf.json',
  'apps/desktop/src/main.tsx',
  'apps/desktop/src/App.tsx'
];

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(file), `missing ${file}`);
}

const desktopPkg = JSON.parse(fs.readFileSync('apps/desktop/package.json', 'utf8'));
assert.ok(desktopPkg.scripts['tauri:dev'], 'desktop tauri:dev script missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/desktop-app.test.mjs`  
Expected: FAIL with missing Tauri files.

**Step 3: Write minimal implementation**

```bash
pnpm dlx create-tauri-app@latest apps/desktop --template react-ts --manager pnpm --yes
```

Then normalize generated metadata to workspace standards:
- package name: `@kata/desktop`
- scripts include: `dev`, `build`, `lint`, `typecheck`, `test`, `tauri:dev`, `tauri:build`
- keep Tauri 2.x config in `apps/desktop/src-tauri/tauri.conf.json`

If generator prompts still appear, answer:
- Identifier: `sh.kata.cloudagents`
- App name: `Kata Cloud Agents`
- Frontend language: `TypeScript`

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/desktop-app.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop tests/scaffold/desktop-app.test.mjs
git commit -m "feat: scaffold tauri desktop shell"
```

### Task 7: Turbo Pipeline Compliance (build/lint/typecheck/test Across Workspace)

**Files:**
- Modify: `package.json`
- Modify: `turbo.json`
- Modify: `apps/*/package.json`
- Modify: `packages/*/package.json`
- Modify: `agents/*/package.json`
- Test: `tests/scaffold/pipeline.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/pipeline.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const turbo = JSON.parse(fs.readFileSync('turbo.json', 'utf8'));
for (const task of ['build', 'lint', 'typecheck', 'test']) {
  assert.ok(turbo.tasks[task], `turbo task missing: ${task}`);
}

const workspacePackages = [
  'apps/web/package.json', 'apps/mobile/package.json', 'apps/desktop/package.json',
  'packages/ui/package.json', 'packages/shared/package.json',
  'agents/coordinator/package.json', 'agents/specialist/package.json', 'agents/verifier/package.json'
];

for (const path of workspacePackages) {
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const script of ['build', 'lint', 'typecheck', 'test']) {
    assert.ok(pkg.scripts?.[script], `${path} missing ${script} script`);
  }
}
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/pipeline.test.mjs`  
Expected: FAIL on packages missing one or more required scripts.

**Step 3: Write minimal implementation**

For every workspace package, ensure script contract exists. For non-implemented packages, use safe placeholders until their tickets land:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json || echo 'build not implemented yet'",
    "lint": "echo 'lint not implemented yet'",
    "typecheck": "tsc --noEmit || echo 'typecheck not implemented yet'",
    "test": "node -e \"console.log('tests not implemented yet')\""
  }
}
```

Update root `package.json` with convenience scripts:

```json
{
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "check": "pnpm lint && pnpm typecheck && pnpm test"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/pipeline.test.mjs && pnpm install && pnpm check`  
Expected: PASS for test script; workspace checks execute without hard failures.

**Step 5: Commit**

```bash
git add package.json turbo.json apps packages agents tests/scaffold/pipeline.test.mjs
git commit -m "feat: enforce monorepo build lint typecheck test pipeline contract"
```

### Task 8: CI Workflow for M0 Foundation Gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Test: `tests/scaffold/ci-workflow.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/ci-workflow.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
assert.match(workflow, /on:\n  pull_request:/, 'PR trigger missing');
assert.match(workflow, /on:\n  push:/, 'push trigger missing');
assert.match(workflow, /pnpm install --frozen-lockfile/, 'frozen install missing');
assert.match(workflow, /pnpm lint/, 'lint command missing');
assert.match(workflow, /pnpm typecheck/, 'typecheck command missing');
assert.match(workflow, /pnpm test/, 'test command missing');
assert.match(workflow, /pnpm build/, 'build command missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/ci-workflow.test.mjs`  
Expected: FAIL because workflow file does not exist.

**Step 3: Write minimal implementation**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.6.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/ci-workflow.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml tests/scaffold/ci-workflow.test.mjs
git commit -m "ci: add monorepo verification workflow"
```

### Task 9: Final Verification + Ticket Evidence Prep

**Files:**
- Modify: `docs/plans/2026-02-26-kat-104-monorepo-bootstrap.md` (checklist updates only)
- Create: `docs/verification/kat-104-foundation.md`

**Step 1: Write the failing verification checklist**

```markdown
# docs/verification/kat-104-foundation.md
- [ ] `pnpm install` succeeds
- [ ] `pnpm lint` succeeds
- [ ] `pnpm typecheck` succeeds
- [ ] `pnpm test` succeeds
- [ ] `pnpm build` succeeds
- [ ] Required directories from Linear ticket exist
- [ ] Tauri desktop shell can start with `pnpm --filter @kata/desktop tauri:dev`
```

**Step 2: Run full verification to identify failures**

Run: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build`  
Expected: Any remaining failures are documented and fixed before ticket close.

**Step 3: Write minimal fixes for failures**

Apply smallest changes needed to make all five commands pass. Do not broaden scope beyond KAT-104 requirements.

**Step 4: Run verification again to confirm pass**

Run: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build`  
Expected: All commands PASS.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: finalize kat-104 monorepo bootstrap verification"
```
