# KAT-150 UI Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce desktop-first registry-driven UI development with a local `ci:checks` gate, pre-push enforcement, and a root command to launch Tauri desktop dev.

**Architecture:** Add a deterministic repo-level drift checker (`check:ui-drift`) and compose it into a new root `ci:checks` script. Enforce local execution via a repo-managed `pre-push` hook. Keep GitHub Actions as final validation by invoking the same `ci:checks` command in CI.

**Tech Stack:** Node.js scripts (`.mjs`), pnpm workspace scripts, Git hooks (`core.hooksPath`), GitHub Actions, existing scaffold tests, Vitest coverage.

---

## Implementation Tasks

### Task 1: Add Root Command Contracts (scripts + scaffold assertions)

**Files:**
- Modify: `package.json`
- Modify: `tests/scaffold/root-workspace.test.mjs`

**Step 1: Write the failing test assertions for new root scripts**

Update `tests/scaffold/root-workspace.test.mjs` to require:
- `scripts.ci:checks`
- `scripts.check:ui-drift`
- `scripts.desktop:tauri:dev`
- `scripts.hooks:install`

```js
assert.ok(pkg.scripts['ci:checks'], 'root ci:checks script missing');
assert.ok(pkg.scripts['check:ui-drift'], 'root check:ui-drift script missing');
assert.ok(pkg.scripts['desktop:tauri:dev'], 'root desktop:tauri:dev script missing');
assert.ok(pkg.scripts['hooks:install'], 'root hooks:install script missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/root-workspace.test.mjs`  
Expected: FAIL with missing script assertion(s).

**Step 3: Add minimal root scripts**

Update `package.json` scripts:
- `"check:ui-drift": "node scripts/check-ui-drift.mjs"`
- `"ci:checks": "pnpm lint && pnpm lint:biome && pnpm typecheck && pnpm test && pnpm coverage && pnpm check:ui-drift"`
- `"desktop:tauri:dev": "pnpm --filter @kata/desktop tauri:dev"`
- `"hooks:install": "node scripts/install-hooks.mjs"`

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/root-workspace.test.mjs`  
Expected: PASS (no output / exit code 0).

**Step 5: Commit**

```bash
git add package.json tests/scaffold/root-workspace.test.mjs
git commit -m "chore(ci): add root ui drift and local ci check scripts"
```

### Task 2: Implement UI Drift Checker with Scaffold Test

**Files:**
- Create: `scripts/check-ui-drift.mjs`
- Create: `tests/scaffold/ui-drift-check.test.mjs`

**Step 1: Write failing test for drift checker behavior**

Create `tests/scaffold/ui-drift-check.test.mjs` using temporary fixtures:
- Case A (valid): app files import from `@kata/ui/components/ui/button` and no local primitive files.
- Case B (invalid): `apps/desktop/src/components/ui/button.tsx`.
- Case C (invalid): import from local `../components/ui/button`.

Test by executing:
- `node scripts/check-ui-drift.mjs --root <tmpDir>`
- Assert exit code `0` for valid and non-zero for invalid, with violation text.

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/ui-drift-check.test.mjs`  
Expected: FAIL (`scripts/check-ui-drift.mjs` missing).

**Step 3: Write minimal implementation**

Create `scripts/check-ui-drift.mjs`:
- Recursively scan:
  - `apps/desktop/src`
  - `apps/web/src`
- Detect forbidden local UI files/directories under `components/ui/` paths.
- Detect forbidden import patterns:
  - relative imports containing `/components/ui/`
  - alias imports like `@/components/ui/`
- Detect forbidden re-export patterns using the same `components/ui` path rules.
- Allow shared imports via `@kata/ui/components/ui/*`.
- Print each violation with file path and reason.
- Exit with code `1` when any violation exists; `0` otherwise.
- Support `--root <path>` for fixture testing.

**Step 4: Run test to verify it passes**

Run:
- `node tests/scaffold/ui-drift-check.test.mjs`
- `pnpm check:ui-drift`

Expected:
- Fixture test PASS.
- Repo drift check PASS on current tree.

**Step 5: Commit**

```bash
git add scripts/check-ui-drift.mjs tests/scaffold/ui-drift-check.test.mjs
git commit -m "feat(ci): enforce shared ui primitive drift checks"
```

### Task 3: Add Pre-Push Enforcement (Repo-Managed Hooks)

**Files:**
- Create: `.githooks/pre-push`
- Create: `scripts/install-hooks.mjs`
- Modify: `package.json`

**Step 1: Write failing test for hook installer output**

Add assertions to `tests/scaffold/root-workspace.test.mjs`:
- `.githooks/pre-push` exists
- `scripts/install-hooks.mjs` exists

```js
assert.ok(fs.existsSync(new URL('../../.githooks/pre-push', import.meta.url)), 'pre-push hook missing');
assert.ok(fs.existsSync(new URL('../../scripts/install-hooks.mjs', import.meta.url)), 'install-hooks script missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/root-workspace.test.mjs`  
Expected: FAIL with missing hook file assertions.

**Step 3: Implement hook installation + hook script**

Create `.githooks/pre-push`:

```sh
#!/bin/sh
set -eu
echo "Running local CI checks before push..."
pnpm ci:checks
```

Create `scripts/install-hooks.mjs`:
- Run: `git config core.hooksPath .githooks`
- Print a short success message.
- No-op with clear message when outside a git worktree.

Update `package.json`:
- Add `"prepare": "pnpm hooks:install"` (or `postinstall` if preferred by team).

**Step 4: Run test to verify it passes**

Run:
- `node tests/scaffold/root-workspace.test.mjs`
- `pnpm hooks:install`
- `git config --get core.hooksPath`

Expected:
- Root scaffold PASS.
- hooksPath resolves to `.githooks`.

**Step 5: Commit**

```bash
git add .githooks/pre-push scripts/install-hooks.mjs package.json tests/scaffold/root-workspace.test.mjs
git commit -m "chore(ci): enforce pre-push local ci checks"
```

### Task 4: Wire `ci:checks` into GitHub Actions Verify Job

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/scaffold/ci-workflow.test.mjs`

**Step 1: Write failing CI workflow assertion**

Update `tests/scaffold/ci-workflow.test.mjs` to require:
- a `pnpm ci:checks` step in `verify` job.

```js
assert.match(workflow, /pnpm ci:checks/, 'ci:checks command missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/ci-workflow.test.mjs`  
Expected: FAIL with missing `ci:checks` assertion.

**Step 3: Update workflow with parity step**

Modify `.github/workflows/ci.yml` verify job:
- Add `- run: pnpm ci:checks` early (after install/cache).
- Remove duplicated individual steps only if redundant and safe.
- Keep `build` and e2e flow unchanged for now.

**Step 4: Run test to verify it passes**

Run:
- `node tests/scaffold/ci-workflow.test.mjs`
- `pnpm ci:checks`

Expected:
- Workflow scaffold PASS.
- Local checks command PASS.

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml tests/scaffold/ci-workflow.test.mjs
git commit -m "ci: run shared ci:checks parity gate in verify job"
```

### Task 5: Document and Verify End-to-End Developer Flow

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/design/AGENTS.md`

**Step 1: Write failing documentation check (manual)**

Create a checklist and verify docs do not yet mention:
- `pnpm ci:checks`
- pre-push enforcement
- root Tauri command `pnpm desktop:tauri:dev`

Expected: at least one missing item.

**Step 2: Run baseline commands**

Run:
- `pnpm ci:checks`
- `pnpm desktop:tauri:dev` (manual smoke, stop after app opens)

Expected:
- checks pass
- desktop app launches from root command

**Step 3: Update docs**

Update `AGENTS.md` and `docs/design/AGENTS.md`:
- Add local workflow section:
  - run `pnpm ci:checks` before push
  - pre-push hook behavior
  - root desktop command
- Keep desktop-first + web deferred guidance intact.

**Step 4: Re-run validation**

Run:
- `pnpm ci:checks`
- `node tests/scaffold/root-workspace.test.mjs`
- `node tests/scaffold/ci-workflow.test.mjs`
- `node tests/scaffold/ui-drift-check.test.mjs`

Expected: all PASS.

**Step 5: Commit**

```bash
git add AGENTS.md docs/design/AGENTS.md
git commit -m "docs(ui): document local ci gates and desktop root workflow"
```

### Task 6: Final Integration Verification and Ticket Evidence

**Files:**
- Modify: `docs/plans/2026-02-28-kat-150-ui-normalization-design.md` (optional verification notes appendix)

**Step 1: Run full local verification sequence**

Run:
- `pnpm lint`
- `pnpm lint:biome`
- `pnpm typecheck`
- `pnpm test`
- `pnpm coverage`
- `pnpm check:ui-drift`

Expected: all PASS.

**Step 2: Verify pre-push gate executes**

Run:
- `.githooks/pre-push` (manual invocation)

Expected:
- prints local check banner
- executes `pnpm ci:checks`

**Step 3: Capture evidence summary for Linear**

Prepare summary:
- scripts added
- hook installed
- drift check pass
- CI workflow updated

**Step 4: Commit verification notes if needed**

```bash
git add docs/plans/2026-02-28-kat-150-ui-normalization-design.md
git commit -m "docs(plan): add KAT-150 verification notes"
```

**Step 5: Open/Update PR and attach evidence**

```bash
git push -u origin feature/kat-150-desktop-first-ui-normalization-standardize-on-kata-shadcn
```
