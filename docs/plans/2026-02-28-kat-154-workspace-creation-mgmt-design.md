# KAT-154 Design: Workspace Creation and Management

## Summary

Introduce first-class desktop workspace management where each workspace maps to an isolated git worktree and becomes the execution boundary for user work. Users can create workspaces from a local repository or a GitHub repository, see workspaces in the left sidebar under a dedicated Workspaces section, and switch active workspace context without doing work in the source repository root or on `main`.

This ticket establishes the foundation that downstream M1 surfaces (spec editor, dispatch pipeline, monitor, result viewer) can consume.

## Context

- `KAT-154` is now `In Progress` and unblocked by `KAT-153` (`Done` as of 2026-02-28).
- The desktop app currently has:
  - route-driven shell nav (`apps/desktop/src/routes.ts`)
  - shell/sidebar components (`apps/desktop/src/components/Layout.tsx`, `Sidebar.tsx`)
  - a minimal UI store (`apps/desktop/src/store/app.ts`)
- There is no existing desktop workspace management module yet.
- Current Tauri backend is minimal (`apps/desktop/src-tauri/src/main.rs`) and does not expose commands.

## Requirements (Issue Source)

- A workspace is an isolated worktree.
- A workspace is created from a local repo or remote repo (GitHub-only for now).
- Work never happens in the main repo local directory or on the main branch.
- Workspaces appear in the left sidebar under a "Workspaces" icon/label.
- Common workflow is one workspace per unit of work (feature/PR/ticket).
- Agent/orchestrator-created worktrees are internal execution details and are not user-managed in this surface.

## Goals

- Provide a durable desktop-local workspace lifecycle (create, list, activate, archive/remove).
- Enforce safe git/worktree rules by default.
- Add a Workspaces sidebar surface without disrupting current route architecture.
- Keep the surface focused on the user workflow: fast creation and switching of feature/PR/ticket workspaces.

## Non-Goals

- No web parity work in this ticket.
- No agent-internal worktree visualization or management UI in this ticket.
- No generalized support for non-GitHub remote providers.
- No complete replacement of existing navigation IA.

## Approaches Considered

### Option A: Tauri-native workspace service (recommended)

Implement workspace management in Tauri Rust commands plus a desktop TS client/store.

Pros:
- Strongest control over file system + git safety constraints.
- Keeps local path handling and command execution off the renderer.
- Good fit for desktop-first milestone and current architecture.
- Clean path to enforce git/worktree invariants in one trusted boundary.

Cons:
- Requires introducing Rust command surface and tests from near-zero baseline.

### Option B: Gateway-backed workspace management service

Model workspaces in gateway APIs first; desktop calls gateway even for local operations.

Pros:
- Centralized model and persistence from day one.
- Easier long-term multi-client parity.

Cons:
- Adds avoidable backend complexity before local desktop value is proven.
- Poor fit for local filesystem-heavy operations in current phase.

### Option C: Frontend-only management via shell plugin calls

Keep logic in React/TS and invoke shell/plugin APIs directly.

Pros:
- Fastest short-term iteration.

Cons:
- Weak security/guardrail boundary.
- Harder to keep git and path invariants consistent.
- Hard to scale safely as workspace operations become richer.

## Decision

Choose Option A.

Build a Tauri-native workspace manager as the source of truth for workspace lifecycle and invariants, with a typed desktop client/store and sidebar integration in `apps/desktop`.

## Architecture

### 1) Domain Model

Introduce a `Workspace` model (shared TS type for desktop usage; Rust struct for command payloads):

- `id`: stable UUID
- `name`: user-facing label
- `sourceType`: `local` | `github`
- `source`:
  - local: absolute repo path
  - github: canonical HTTPS repo URL
- `repoRootPath`: canonical repo root used to create worktrees (never active work directory)
- `worktreePath`: absolute path of this workspace
- `branch`: workspace branch
- `baseRef`: source ref used during creation (default branch unless explicit)
- `status`: `ready` | `creating` | `error` | `archived`
- `createdAt`, `updatedAt`
- `lastOpenedAt`

### 2) Persistence and Layout

Persist workspace registry under app data directory (Tauri app path API), e.g.:

- `.../kata-cloud-agents/workspaces/workspaces.json`
- `.../kata-cloud-agents/workspaces/<workspace-id>/...` (worktree roots)
- `.../kata-cloud-agents/repo-cache/github/<owner>__<repo>/` (remote canonical clone/cache)

Key rule: `repoRootPath` is never used as the active working directory in user workflows.

### 3) Tauri Command Surface

Add Tauri commands for desktop-only workspace lifecycle:

- `workspace_list()`
- `workspace_get(id)`
- `workspace_create_local(input)`
- `workspace_create_github(input)`
- `workspace_set_active(id)`
- `workspace_archive(id)`
- `workspace_delete(id, remove_files: bool)`

Input contracts:
- Local creation input: `repoPath`, `workspaceName`, optional `branchName`, optional `baseRef`
- GitHub creation input: `repoUrl`, `workspaceName`, optional `branchName`, optional `baseRef`

### 4) Git Invariants and Guardrails

Creation flow invariants:

- Validate git exists and repo is valid.
- Reject non-GitHub remotes for `workspace_create_github`.
- Always create worktree path separate from repo root.
- Never create workspace on `main` or `master`.
- Default branch naming: `workspace/<slug>-<short-id>` when not provided.
- If branch exists locally/remotely, fail with actionable error.
- Detect path collisions and fail fast.

For GitHub source:
- Maintain/refresh a local canonical repo cache (fetch before branch/worktree creation).
- Use existing user git credential helper (no in-ticket credential UI).

### 5) Desktop UI Integration

Sidebar changes:

- Add `Workspaces` section with icon/label in left sidebar.
- Provide create CTA and workspace list rows.
- Active workspace highlighted.
- Collapsed sidebar preserves icon + tooltip behavior.

Main surface additions (minimal for this ticket):

- `Workspaces` management route/page for create/manage actions.
- Modal/form for create-from-local vs create-from-GitHub.
- Basic per-workspace actions: activate, archive/remove.

### 6) Active Workspace Context

Add desktop state for:

- `activeWorkspaceId`
- `workspaces[]`
- async action states (`isCreating`, `lastError`)

All later execution flows should resolve working directory from `activeWorkspaceId` -> `worktreePath`.

### 7) Agent-Internal Worktrees (Out of Scope for UI)

The user-facing workspace manager in this ticket only covers user-created workspaces. If an orchestrator later creates additional isolated worktrees for sub-agents, those are internal execution artifacts and should not appear as user-managed workspaces in this surface.

## Data Flow

### Create From Local Repo

1. User submits local repo path + workspace metadata.
2. Command validates repo and resolves default branch/base ref.
3. Command creates non-main branch + worktree path.
4. Command writes workspace record and returns it.
5. UI refreshes list and optionally activates new workspace.

### Create From GitHub Repo

1. User submits GitHub URL + workspace metadata.
2. Command validates URL host (`github.com`) and repository reachability.
3. Command clones/refreshes canonical cache repo.
4. Command creates non-main branch + worktree path from cache.
5. Command writes workspace record and returns it.

### Activate Workspace

1. User selects workspace in sidebar.
2. Store updates `activeWorkspaceId`.
3. Downstream pages consume workspace context for operations.

## Error Handling

Return typed, user-actionable errors for:

- invalid git repo path
- unsupported remote provider
- GitHub clone/fetch auth failures
- branch conflicts
- attempted main/master workspace branch
- filesystem permission/path collisions
- missing/deleted worktree directories (stale registry entries)

UI behavior:
- Inline form errors for creation.
- Non-blocking banners/toasts for background refresh failures.
- Recovery action for stale workspace entries (`repair`/`remove`).

## Testing Strategy

### Rust/Tauri

- Unit tests for validation and branch naming logic.
- Integration tests using temp git repos for:
  - local creation success
  - github URL validation
  - branch collision failure
  - main-branch rejection
  - delete/archive behavior

### Desktop React/TS

- Sidebar tests for Workspaces section render/collapse/active row.
- Workspaces page tests for local/github form paths and error states.
- Store tests for create/list/activate flows.

### End-to-End (follow-up-ready)

- Create local workspace -> appears in sidebar -> activate -> persists across restart.
- Create GitHub workspace (public repo fixture) -> appears and activates.

## Rollout Notes

- Desktop-first only, aligned with current milestone sequencing.
- Keep existing nav route model; add workspace UX as additive shell/page behavior.
- This ticket should provide the workspace substrate consumed by KAT-112, KAT-116, KAT-117, and KAT-118.

## Open Questions

- Should user-visible workspace removal default to archive-only in M1, with hard delete behind explicit confirmation?
- Should we allow optional auto-open-in-editor after workspace creation in this ticket, or defer to follow-up?

## Recommendation

Approve this design as the implementation baseline. On approval, move directly to `writing-plans` and produce a concrete execution plan with file-by-file tasks and verification gates.
