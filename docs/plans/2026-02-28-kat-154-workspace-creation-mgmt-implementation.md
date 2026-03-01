# KAT-154 Workspace Creation & Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build desktop-first, user-managed workspace creation and management where each workspace is an isolated git worktree created from a local repo or GitHub repo, with Workspaces visible and manageable from the left sidebar.

**Architecture:** Use a layered desktop design: React UI + Zustand store + typed workspace service client on the frontend, backed by Tauri Rust commands that enforce git/worktree invariants. Keep user-facing scope focused on feature/PR/ticket workspaces only; agent-internal worktrees remain internal and out of this UI. Start with test-first frontend contracts, then add Rust command/persistence/git flows incrementally.

**Tech Stack:** Tauri 2 (Rust commands), React 18, React Router 6, Zustand, TypeScript, Vitest + Testing Library, git CLI, local filesystem persistence via Tauri app data dir.

**Execution Skills:** `@test-driven-development`, `@verification-before-completion`

---

### Task 1: Define Desktop Workspace Domain Contracts

**Files:**
- Create: `apps/desktop/src/types/workspace.ts`
- Create: `tests/unit/desktop/workspace-types.test.ts`

**Step 1: Write the failing test for workspace contract and helpers**

```ts
import { describe, expect, test } from 'vitest';
import { WorkspaceSchema, isGitHubRepoUrl, deriveWorkspaceBranchName } from '../../../apps/desktop/src/types/workspace';

describe('workspace domain contract', () => {
  test('accepts local and github sources', () => {
    expect(
      WorkspaceSchema.parse({
        id: 'ws_1',
        name: 'KAT-154 UI',
        sourceType: 'local',
        source: '/Users/me/dev/repo',
        repoRootPath: '/Users/me/dev/repo',
        worktreePath: '/Users/me/dev/repo.worktrees/kat-154-ui',
        branch: 'workspace/kat-154-ui-ws1',
        status: 'ready',
        createdAt: '2026-02-28T00:00:00.000Z',
        updatedAt: '2026-02-28T00:00:00.000Z',
      }),
    ).toBeTruthy();
  });

  test('validates github URLs and branch slugging', () => {
    expect(isGitHubRepoUrl('https://github.com/org/repo')).toBe(true);
    expect(isGitHubRepoUrl('https://gitlab.com/org/repo')).toBe(false);
    expect(deriveWorkspaceBranchName('KAT-154 Workspace', 'ab12')).toBe('workspace/kat-154-workspace-ab12');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/desktop/workspace-types.test.ts`
Expected: FAIL because `workspace.ts` does not exist.

**Step 3: Write minimal implementation**

```ts
import { z } from 'zod';

export const WorkspaceStatusSchema = z.enum(['ready', 'creating', 'error', 'archived']);
export const WorkspaceSourceTypeSchema = z.enum(['local', 'github']);

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  sourceType: WorkspaceSourceTypeSchema,
  source: z.string().min(1),
  repoRootPath: z.string().min(1),
  worktreePath: z.string().min(1),
  branch: z.string().min(1),
  baseRef: z.string().optional(),
  status: WorkspaceStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime().optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export function isGitHubRepoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com';
  } catch {
    return false;
  }
}

export function deriveWorkspaceBranchName(name: string, suffix: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  return `workspace/${slug}-${suffix}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/unit/desktop/workspace-types.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/types/workspace.ts tests/unit/desktop/workspace-types.test.ts
git commit -m "feat(desktop): add workspace domain contracts"
```

### Task 2: Add Workspaces Route and Page Scaffold

**Files:**
- Create: `apps/desktop/src/pages/Workspaces.tsx`
- Modify: `apps/desktop/src/routes.ts`
- Modify: `tests/unit/desktop/pages.test.tsx`
- Modify: `tests/unit/desktop/routes.test.ts`
- Modify: `tests/unit/desktop/navigation.test.tsx`

**Step 1: Write failing route/page tests**

```ts
// routes.test.ts
const workspaces = routes.find((route) => route.id === 'workspaces');
expect(workspaces?.path).toBe('/workspaces');
expect(workspaces?.navLabel).toBe('Workspaces');
expect(workspaces?.breadcrumbLabel).toBe('Workspaces');
```

```tsx
// navigation.test.tsx
fireEvent.click(screen.getByRole('link', { name: /workspaces/i }));
expect(screen.getByRole('heading', { name: 'Workspaces' })).toBeInTheDocument();
```

**Step 2: Run tests to verify failure**

Run:
```bash
pnpm exec vitest run \
  tests/unit/desktop/pages.test.tsx \
  tests/unit/desktop/routes.test.ts \
  tests/unit/desktop/navigation.test.tsx
```
Expected: FAIL because Workspaces route/page is missing.

**Step 3: Implement minimal route/page**

```tsx
// pages/Workspaces.tsx
export function Workspaces() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <p className="mt-2 text-slate-400">Create and manage isolated git workspaces for active work.</p>
    </div>
  );
}
```

```ts
// routes.ts (add)
| 'workspaces';

{
  id: 'workspaces',
  path: '/workspaces',
  icon: FolderGit2,
  component: Workspaces,
  navGroup: 'command-center',
  navLabel: 'Workspaces',
  breadcrumbLabel: 'Workspaces',
}
```

**Step 4: Run tests to verify pass**

Run:
```bash
pnpm exec vitest run \
  tests/unit/desktop/pages.test.tsx \
  tests/unit/desktop/routes.test.ts \
  tests/unit/desktop/navigation.test.tsx
```
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/pages/Workspaces.tsx apps/desktop/src/routes.ts tests/unit/desktop/pages.test.tsx tests/unit/desktop/routes.test.ts tests/unit/desktop/navigation.test.tsx
git commit -m "feat(desktop): add workspaces route scaffold"
```

### Task 3: Create Workspace Service Interface and In-Memory Adapter

**Files:**
- Create: `apps/desktop/src/services/workspaces/types.ts`
- Create: `apps/desktop/src/services/workspaces/memory-client.ts`
- Create: `tests/unit/desktop/workspace-memory-client.test.ts`

**Step 1: Write failing service tests**

```ts
import { createMemoryWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/memory-client';

test('creates and lists workspaces', async () => {
  const client = createMemoryWorkspaceClient();
  await client.createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
  const all = await client.list();
  expect(all).toHaveLength(1);
});

test('tracks active workspace', async () => {
  const client = createMemoryWorkspaceClient();
  const ws = await client.createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
  await client.setActive(ws.id);
  expect(await client.getActiveId()).toBe(ws.id);
});
```

**Step 2: Run test to verify failure**

Run: `pnpm exec vitest run tests/unit/desktop/workspace-memory-client.test.ts`
Expected: FAIL because service files do not exist.

**Step 3: Implement minimal interface + memory adapter**

```ts
export interface WorkspaceClient {
  list(): Promise<Workspace[]>;
  createLocal(input: { repoPath: string; workspaceName: string; branchName?: string; baseRef?: string }): Promise<Workspace>;
  createGitHub(input: { repoUrl: string; workspaceName: string; branchName?: string; baseRef?: string }): Promise<Workspace>;
  setActive(id: string): Promise<void>;
  getActiveId(): Promise<string | null>;
  archive(id: string): Promise<void>;
  remove(id: string, removeFiles: boolean): Promise<void>;
}
```

**Step 4: Run test to verify pass**

Run: `pnpm exec vitest run tests/unit/desktop/workspace-memory-client.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/services/workspaces/types.ts apps/desktop/src/services/workspaces/memory-client.ts tests/unit/desktop/workspace-memory-client.test.ts
git commit -m "feat(desktop): add workspace service interface and memory adapter"
```

### Task 4: Add Workspace Zustand Store

**Files:**
- Create: `apps/desktop/src/store/workspaces.ts`
- Create: `tests/unit/desktop/workspaces-store.test.ts`

**Step 1: Write failing store tests**

```ts
import { useWorkspacesStore } from '../../../apps/desktop/src/store/workspaces';

test('load fetches workspaces into state', async () => {
  await useWorkspacesStore.getState().load();
  expect(Array.isArray(useWorkspacesStore.getState().workspaces)).toBe(true);
});

test('createLocal appends and sets active workspace', async () => {
  await useWorkspacesStore.getState().createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
  const state = useWorkspacesStore.getState();
  expect(state.workspaces.length).toBe(1);
  expect(state.activeWorkspaceId).toBe(state.workspaces[0]?.id);
});
```

**Step 2: Run test to verify failure**

Run: `pnpm exec vitest run tests/unit/desktop/workspaces-store.test.ts`
Expected: FAIL because `workspaces.ts` store is missing.

**Step 3: Implement minimal store with async actions**

```ts
interface WorkspacesState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isCreating: boolean;
  lastError: string | null;
  load: () => Promise<void>;
  createLocal: (input: CreateLocalWorkspaceInput) => Promise<void>;
  createGitHub: (input: CreateGitHubWorkspaceInput) => Promise<void>;
  setActive: (id: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  remove: (id: string, removeFiles: boolean) => Promise<void>;
}
```

**Step 4: Run test to verify pass**

Run: `pnpm exec vitest run tests/unit/desktop/workspaces-store.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/store/workspaces.ts tests/unit/desktop/workspaces-store.test.ts
git commit -m "feat(desktop): add workspace zustand store"
```

### Task 5: Render Workspaces in Sidebar

**Files:**
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Modify: `tests/unit/desktop/sidebar.test.tsx`

**Step 1: Write failing sidebar test for Workspaces group and active state**

```tsx
test('renders Workspaces section and active workspace marker', async () => {
  renderSidebar('/workspaces');
  expect(screen.getByText('Workspaces')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /workspaces/i })).toHaveClass('bg-slate-800');
});
```

**Step 2: Run test to verify failure**

Run: `pnpm exec vitest run tests/unit/desktop/sidebar.test.tsx`
Expected: FAIL on new Workspaces assertions.

**Step 3: Implement sidebar rendering updates**

```tsx
{!collapsed ? (
  <h2 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Workspaces</h2>
) : null}
<NavLink to="/workspaces" ...>...</NavLink>
```

**Step 4: Run test to verify pass**

Run: `pnpm exec vitest run tests/unit/desktop/sidebar.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/components/Sidebar.tsx tests/unit/desktop/sidebar.test.tsx
git commit -m "feat(desktop): add workspaces section to sidebar"
```

### Task 6: Build Workspaces Page UX (Create + Manage)

**Files:**
- Modify: `apps/desktop/src/pages/Workspaces.tsx`
- Create: `tests/unit/desktop/workspaces-page.test.tsx`

**Step 1: Write failing Workspaces page tests for create flows**

```tsx
test('supports local workspace creation form', async () => {
  render(<Workspaces />);
  await user.type(screen.getByLabelText(/local repository path/i), '/tmp/repo');
  await user.type(screen.getByLabelText(/workspace name/i), 'KAT-154');
  await user.click(screen.getByRole('button', { name: /create workspace/i }));
  expect(await screen.findByText(/KAT-154/i)).toBeInTheDocument();
});

test('validates github URL mode', async () => {
  render(<Workspaces />);
  await user.click(screen.getByRole('radio', { name: /github repository/i }));
  await user.type(screen.getByLabelText(/github repository url/i), 'https://gitlab.com/org/repo');
  await user.click(screen.getByRole('button', { name: /create workspace/i }));
  expect(await screen.findByText(/github.com repositories are supported/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify failure**

Run: `pnpm exec vitest run tests/unit/desktop/workspaces-page.test.tsx`
Expected: FAIL because form/actions do not exist.

**Step 3: Implement minimal page interactions**

```tsx
<form onSubmit={onSubmit} className="space-y-4">
  {/* mode toggle: local vs github */}
  {/* local path input OR github URL input */}
  {/* workspace name input */}
  <button type="submit">Create Workspace</button>
</form>

<ul>{workspaces.map((ws) => <li key={ws.id}>{ws.name}</li>)}</ul>
```

**Step 4: Run test to verify pass**

Run: `pnpm exec vitest run tests/unit/desktop/workspaces-page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/pages/Workspaces.tsx tests/unit/desktop/workspaces-page.test.tsx
git commit -m "feat(desktop): implement workspace creation and management page"
```

### Task 7: Add Tauri Invoke Client on Frontend

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/services/workspaces/tauri-client.ts`
- Create: `apps/desktop/src/services/workspaces/index.ts`
- Create: `tests/unit/desktop/workspace-tauri-client.test.ts`
- Modify: `apps/desktop/src/store/workspaces.ts`

**Step 1: Write failing tauri client tests**

```ts
import { createTauriWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/tauri-client';

test('maps list command response', async () => {
  const client = createTauriWorkspaceClient(mockInvoke);
  const list = await client.list();
  expect(list[0]?.name).toBe('KAT-154');
});
```

**Step 2: Run test to verify failure**

Run: `pnpm exec vitest run tests/unit/desktop/workspace-tauri-client.test.ts`
Expected: FAIL because tauri client files and dependency are missing.

**Step 3: Implement tauri client and service selection**

- Add dependency: `@tauri-apps/api` to `apps/desktop/package.json`.
- Map commands:
  - `workspace_list`
  - `workspace_create_local`
  - `workspace_create_github`
  - `workspace_set_active`
  - `workspace_archive`
  - `workspace_delete`

```ts
import { invoke } from '@tauri-apps/api/core';

export const tauriWorkspaceClient: WorkspaceClient = {
  list: () => invoke('workspace_list'),
  createLocal: (input) => invoke('workspace_create_local', { input }),
  createGitHub: (input) => invoke('workspace_create_github', { input }),
  setActive: (id) => invoke('workspace_set_active', { id }),
  archive: (id) => invoke('workspace_archive', { id }),
  remove: (id, removeFiles) => invoke('workspace_delete', { id, removeFiles }),
  getActiveId: () => invoke('workspace_get_active_id'),
};
```

**Step 4: Run test to verify pass**

Run: `pnpm exec vitest run tests/unit/desktop/workspace-tauri-client.test.ts tests/unit/desktop/workspaces-store.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/src/services/workspaces/tauri-client.ts apps/desktop/src/services/workspaces/index.ts apps/desktop/src/store/workspaces.ts tests/unit/desktop/workspace-tauri-client.test.ts
git commit -m "feat(desktop): wire workspace store to tauri workspace commands"
```

### Task 8: Add Rust Workspace Registry + Command Skeleton

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/workspaces/mod.rs`
- Create: `apps/desktop/src-tauri/src/workspaces/model.rs`
- Create: `apps/desktop/src-tauri/src/workspaces/store.rs`
- Create: `apps/desktop/src-tauri/src/workspaces/commands.rs`

**Step 1: Write failing Rust tests for registry load/save/list/active**

```rust
#[test]
fn saves_and_loads_workspace_registry() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = WorkspaceStore::new(dir.path());
    store.insert(sample_workspace("ws_1"));
    store.save().unwrap();

    let loaded = WorkspaceStore::load(dir.path()).unwrap();
    assert_eq!(loaded.list().len(), 1);
}

#[test]
fn sets_active_workspace_id() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = WorkspaceStore::new(dir.path());
    store.insert(sample_workspace("ws_1"));
    store.set_active("ws_1").unwrap();
    assert_eq!(store.active_workspace_id(), Some("ws_1".to_string()));
}
```

**Step 2: Run Rust tests to verify failure**

Run: `cd apps/desktop/src-tauri && cargo test workspaces:: -- --nocapture`
Expected: FAIL because workspace modules do not exist.

**Step 3: Implement minimal registry and command handlers**

- Add serde + uuid + chrono + thiserror + tempfile (dev) dependencies.
- Register commands in `tauri::generate_handler!`.
- Persist `workspaces.json` under app data directory.

```rust
#[tauri::command]
pub fn workspace_list(state: tauri::State<WorkspaceState>) -> Result<Vec<Workspace>, String> { ... }

#[tauri::command]
pub fn workspace_get_active_id(state: tauri::State<WorkspaceState>) -> Result<Option<String>, String> { ... }

#[tauri::command]
pub fn workspace_set_active(id: String, state: tauri::State<WorkspaceState>) -> Result<(), String> { ... }
```

**Step 4: Run Rust tests to verify pass**

Run: `cd apps/desktop/src-tauri && cargo test workspaces:: -- --nocapture`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/main.rs apps/desktop/src-tauri/src/workspaces
git commit -m "feat(desktop-tauri): add workspace registry and command skeleton"
```

### Task 9: Implement `workspace_create_local` with Git Worktree Invariants

**Files:**
- Modify: `apps/desktop/src-tauri/src/workspaces/model.rs`
- Modify: `apps/desktop/src-tauri/src/workspaces/store.rs`
- Modify: `apps/desktop/src-tauri/src/workspaces/commands.rs`
- Create: `apps/desktop/src-tauri/src/workspaces/git_local.rs`

**Step 1: Write failing Rust tests for local workspace creation**

```rust
#[test]
fn creates_local_workspace_in_separate_worktree_path() {
    let fixture = LocalRepoFixture::new();
    let created = create_local_workspace(&fixture.repo_path, "KAT-154", None, None).unwrap();

    assert!(created.worktree_path.contains("workspaces"));
    assert_ne!(created.worktree_path, created.repo_root_path);
}

#[test]
fn rejects_main_or_master_branch_creation() {
    let fixture = LocalRepoFixture::new();
    let err = create_local_workspace(&fixture.repo_path, "KAT-154", Some("main".into()), None).unwrap_err();
    assert!(err.to_string().contains("main/master"));
}
```

**Step 2: Run Rust tests to verify failure**

Run: `cd apps/desktop/src-tauri && cargo test workspaces::git_local -- --nocapture`
Expected: FAIL.

**Step 3: Implement local git flow**

- Validate repo path and git metadata.
- Resolve default branch/base ref.
- Create `workspace/<slug>-<id>` branch when missing explicit branch.
- Reject `main`/`master` branch names.
- Run `git worktree add <worktreePath> -b <branch> <baseRef>`.

**Step 4: Run Rust tests to verify pass**

Run: `cd apps/desktop/src-tauri && cargo test workspaces::git_local -- --nocapture`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/workspaces/model.rs apps/desktop/src-tauri/src/workspaces/store.rs apps/desktop/src-tauri/src/workspaces/commands.rs apps/desktop/src-tauri/src/workspaces/git_local.rs
git commit -m "feat(desktop-tauri): implement local workspace worktree creation"
```

### Task 10: Implement `workspace_create_github`, Archive/Delete, and End-to-End Verification

**Files:**
- Modify: `apps/desktop/src-tauri/src/workspaces/commands.rs`
- Create: `apps/desktop/src-tauri/src/workspaces/git_github.rs`
- Modify: `apps/desktop/src-tauri/src/workspaces/store.rs`
- Modify: `tests/unit/desktop/workspaces-page.test.tsx`
- Modify: `tests/unit/desktop/workspaces-store.test.ts`
- Optional modify: `apps/desktop/src-tauri/capabilities/default.json` (only if command permission config requires explicit allows)

**Step 1: Write failing tests for GitHub-only create + archive/delete**

```rust
#[test]
fn rejects_non_github_remote_urls() {
    let err = create_github_workspace("https://gitlab.com/org/repo", "KAT-154", None, None).unwrap_err();
    assert!(err.to_string().contains("github.com"));
}
```

```ts
// workspaces-store.test.ts
await store.createGitHub({ repoUrl: 'https://github.com/org/repo', workspaceName: 'KAT-154 GH' });
await store.archive(id);
await store.remove(id, false);
expect(store.workspaces.find((w) => w.id === id)).toBeUndefined();
```

**Step 2: Run tests to verify failure**

Run:
```bash
cd apps/desktop/src-tauri && cargo test workspaces::git_github -- --nocapture
pnpm exec vitest run tests/unit/desktop/workspaces-store.test.ts tests/unit/desktop/workspaces-page.test.tsx
```
Expected: FAIL on new create/archive/delete expectations.

**Step 3: Implement GitHub + archive/delete flows**

- Validate `https://github.com/<owner>/<repo>`.
- Clone/fetch canonical cache under app data repo-cache.
- Create worktree from cached repo with same invariants as local flow.
- Implement `workspace_archive` (status -> `archived`) and `workspace_delete` (registry removal + optional fs removal).

**Step 4: Run full verification**

Run:
```bash
cd apps/desktop/src-tauri && cargo test -- --nocapture
pnpm exec vitest run \
  tests/unit/desktop/workspace-types.test.ts \
  tests/unit/desktop/workspace-memory-client.test.ts \
  tests/unit/desktop/workspace-tauri-client.test.ts \
  tests/unit/desktop/workspaces-store.test.ts \
  tests/unit/desktop/workspaces-page.test.tsx \
  tests/unit/desktop/sidebar.test.tsx \
  tests/unit/desktop/navigation.test.tsx \
  tests/unit/desktop/routes.test.ts
pnpm ci:checks
```
Expected: PASS across Rust tests, desktop unit tests, and repo parity checks.

**Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/workspaces apps/desktop/src-tauri/capabilities/default.json tests/unit/desktop/workspaces-store.test.ts tests/unit/desktop/workspaces-page.test.tsx
git commit -m "feat(desktop-tauri): add github workspace creation and lifecycle commands"
```

### Task 11: Linear Evidence + PR Notes

**Files:**
- Modify: `docs/plans/2026-02-28-kat-154-workspace-creation-mgmt-design.md` (optional short “Implemented” note)
- Add: PR description/checklist text (when opening PR)

**Step 1: Prepare acceptance mapping**

Document exact proof points in PR notes:

```md
- [x] Workspace is isolated worktree (command + test evidence)
- [x] Local and GitHub creation flows implemented
- [x] No work in repo root/main branch enforced by invariants
- [x] Workspaces visible in left sidebar section
- [x] User flow supports one-workspace-per-ticket workflow
- [x] Agent-internal worktrees remain out of user-managed UI
```

**Step 2: Add command/test evidence block**

```md
## Verification
- `cargo test` (apps/desktop/src-tauri)
- `pnpm exec vitest run tests/unit/desktop/...`
- `pnpm ci:checks`
```

**Step 3: Commit docs-only updates (if any)**

```bash
git add docs/plans/2026-02-28-kat-154-workspace-creation-mgmt-design.md
git commit -m "docs(kat-154): add implementation evidence summary"
```

**Step 4: Push and open PR**

Run:
```bash
git push
# then open PR with acceptance + verification evidence
```
Expected: branch updated and PR ready for review.
