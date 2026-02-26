# KAT-110 CI Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production CI pipeline with Turborepo-aware caching, ESLint + Biome linting, typechecking, testing, and cross-platform Tauri desktop builds (macOS, Windows, Linux).

**Architecture:** Extend the existing `ci.yml` verify job with Turbo file caching and Biome linting. Add a separate `tauri-build` matrix job that compiles the desktop app on all three platforms using Rust caching. Both jobs must pass for PR merge.

**Tech Stack:** GitHub Actions, Turborepo, Biome, ESLint, pnpm, Tauri 2.x, Rust stable, swatinem/rust-cache, actions/cache

---

Execution discipline references: `@test-driven-development`, `@verification-before-completion`, `@committing-changes`

## Implementation Tasks

### Task 1: Add Biome Linter

**Files:**
- Create: `biome.json`
- Modify: `package.json` (add devDependency + script)
- Create: `tests/scaffold/biome-config.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/biome-config.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const biome = JSON.parse(fs.readFileSync('biome.json', 'utf8'));
assert.ok(biome.$schema, 'biome schema reference missing');
assert.equal(biome.linter.enabled, true, 'biome linter must be enabled');
assert.equal(biome.formatter.enabled, false, 'biome formatter must be disabled (Prettier handles formatting)');
assert.ok(biome.files.ignore.includes('dist/**'), 'biome must ignore dist');
assert.ok(biome.files.ignore.includes('node_modules/**'), 'biome must ignore node_modules');

const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.ok(rootPkg.scripts['lint:biome'], 'root lint:biome script missing');
assert.ok(rootPkg.devDependencies['@biomejs/biome'], '@biomejs/biome devDependency missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/biome-config.test.mjs`
Expected: FAIL with "no such file or directory" for biome.json

**Step 3: Install Biome and create config**

Run: `pnpm add -Dw @biomejs/biome`

Then create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.6/schema.json",
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": false
  },
  "organizeImports": {
    "enabled": false
  },
  "files": {
    "ignore": [
      "dist/**",
      "build/**",
      "node_modules/**",
      ".turbo/**",
      "coverage/**"
    ]
  }
}
```

Add script to root `package.json`:

```json
"lint:biome": "biome check ."
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/biome-config.test.mjs`
Expected: PASS (no output)

**Step 5: Verify Biome runs cleanly**

Run: `pnpm lint:biome`
Expected: Biome reports results. Fix any violations it finds in existing code (likely minor issues). Biome's recommended ruleset may flag things ESLint doesn't. Fix violations or disable specific rules in `biome.json` under `linter.rules` as needed.

**Step 6: Commit**

```bash
git add biome.json package.json pnpm-lock.yaml tests/scaffold/biome-config.test.mjs
git commit -m "feat(ci): add Biome linter configuration"
```

---

### Task 2: Add Rust Toolchain Pinning

**Files:**
- Create: `apps/desktop/src-tauri/rust-toolchain.toml`
- Create: `tests/scaffold/rust-toolchain.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/rust-toolchain.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const toolchain = fs.readFileSync('apps/desktop/src-tauri/rust-toolchain.toml', 'utf8');
assert.match(toolchain, /channel\s*=\s*"stable"/, 'rust-toolchain.toml must pin stable channel');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/rust-toolchain.test.mjs`
Expected: FAIL with "no such file or directory"

**Step 3: Create rust-toolchain.toml**

```toml
# apps/desktop/src-tauri/rust-toolchain.toml
[toolchain]
channel = "stable"
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/rust-toolchain.test.mjs`
Expected: PASS

**Step 5: Generate Cargo.lock**

If Rust is installed locally:

```bash
cd apps/desktop/src-tauri && cargo generate-lockfile
```

If Rust is not installed, skip this step. The CI Tauri build will generate it. Add `Cargo.lock` to `.gitignore` under `apps/desktop/src-tauri/` if not committing it, OR commit it for reproducible builds (preferred).

**Step 6: Commit**

```bash
git add apps/desktop/src-tauri/rust-toolchain.toml tests/scaffold/rust-toolchain.test.mjs
# If Cargo.lock was generated:
git add apps/desktop/src-tauri/Cargo.lock
git commit -m "feat(ci): add Rust toolchain pinning and lockfile"
```

---

### Task 3: Enhance CI Verify Job with Caching

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/scaffold/ci-workflow.test.mjs`

**Step 1: Update the scaffold test**

Replace `tests/scaffold/ci-workflow.test.mjs` with:

```javascript
// tests/scaffold/ci-workflow.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

// Triggers
assert.match(workflow, /pull_request:/, 'PR trigger missing');
assert.match(workflow, /push:/, 'push trigger missing');

// Verify job basics
assert.match(workflow, /pnpm install --frozen-lockfile/, 'frozen install missing');
assert.match(workflow, /pnpm lint/, 'lint command missing');
assert.match(workflow, /pnpm typecheck/, 'typecheck command missing');
assert.match(workflow, /pnpm test/, 'test command missing');
assert.match(workflow, /pnpm build/, 'build command missing');
assert.match(workflow, /pnpm coverage/, 'coverage gate command missing');
assert.match(workflow, /playwright install --with-deps chromium/, 'playwright browser install missing');
assert.match(workflow, /pnpm test:e2e/, 'e2e command missing');

// Biome lint step
assert.match(workflow, /biome|lint:biome/, 'biome lint step missing');

// Turbo cache
assert.match(workflow, /\.turbo/, 'Turbo cache path missing');
assert.match(workflow, /actions\/cache/, 'actions/cache for Turbo missing');

// Tauri build job
assert.match(workflow, /tauri-build/, 'tauri-build job missing');
assert.match(workflow, /macos/, 'macOS platform missing from tauri-build');
assert.match(workflow, /ubuntu/, 'Ubuntu platform missing from tauri-build');
assert.match(workflow, /windows/, 'Windows platform missing from tauri-build');

// Rust setup in tauri-build
assert.match(workflow, /dtolnay\/rust-toolchain/, 'Rust toolchain setup missing');
assert.match(workflow, /swatinem\/rust-cache/, 'Rust cache missing');

// Linux system deps
assert.match(workflow, /libwebkit2gtk/, 'Linux webkit2gtk dependency missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/ci-workflow.test.mjs`
Expected: FAIL on biome, Turbo cache, and tauri-build assertions

**Step 3: Rewrite the verify job in ci.yml**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

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

      - name: Turbo cache
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-

      - run: pnpm lint
      - run: pnpm lint:biome
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

      - name: Coverage gate
        run: pnpm coverage

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E smoke tests
        run: pnpm test:e2e

  tauri-build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
          - platform: ubuntu-22.04
            args: ''
          - platform: windows-latest
            args: ''
    runs-on: ${{ matrix.platform }}
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

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: 'apps/desktop/src-tauri -> target'

      - name: Install system dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Turbo cache
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-

      - name: Build frontend packages
        run: pnpm build

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        with:
          projectPath: apps/desktop
          tauriScript: pnpm tauri
          args: ${{ matrix.args }}
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/ci-workflow.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml tests/scaffold/ci-workflow.test.mjs
git commit -m "feat(ci): enhance verify job with Turbo cache and Biome, add Tauri build matrix"
```

---

### Task 4: Verify Full Pipeline Locally

**Step 1: Run all scaffold tests**

```bash
for f in tests/scaffold/*.test.mjs; do echo "--- $f ---"; node "$f"; done
```

Expected: All tests pass.

**Step 2: Run lint pipeline**

```bash
pnpm lint && pnpm lint:biome
```

Expected: Both pass cleanly.

**Step 3: Run typecheck + test + build**

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: All pass.

**Step 4: Commit any fixes**

If any of the above steps required code changes (Biome rule violations, etc.):

```bash
git add -A
git commit -m "fix(ci): resolve lint violations from Biome integration"
```

---

### Task 5: Branch Protection Configuration (Manual)

This step requires GitHub repository admin access and cannot be automated via CI.

**Instructions for repo admin:**

1. Go to GitHub repo Settings > Branches > Branch protection rules
2. Add rule for `main` branch
3. Enable:
   - "Require a pull request before merging"
   - "Require status checks to pass before merging"
   - Add required checks: `verify`, `tauri-build` (all matrix entries)
   - "Require branches to be up to date before merging"
4. Save

This ensures both the verify job and all Tauri build matrix entries must pass before a PR can merge.

---

## Key Design Decisions

**Biome as linter only (formatter disabled):** Prettier already handles formatting. Biome provides fast, additional lint rules that complement ESLint's type-aware checking.

**Separate verify and tauri-build jobs:** The verify job runs fast on Ubuntu only. The tauri-build job runs the expensive Rust compilation on all three platforms. They run in parallel.

**`concurrency` with cancel-in-progress:** New pushes to the same branch cancel in-progress CI runs, saving runner minutes.

**Turbo file cache via actions/cache:** Persists `.turbo/` between CI runs. Turborepo skips unchanged packages on cache hit. No remote cache service needed.

**swatinem/rust-cache for Rust target/:** Caches compiled Rust dependencies between CI runs. Significantly speeds up Tauri builds (from ~10min to ~2min on cache hit).

**tauri-apps/tauri-action without release config:** Used in build-only mode (no `tagName`). Handles platform-specific Tauri bundling. Release automation is a separate concern for a future ticket.
