# AGENTS Addendum (docs/design)

## Pencil <-> Code Workflow

Use this process for UI work so design and implementation stay in sync:

1. Start from code truth in `apps/desktop` and pick one page/surface at a time.
2. Mirror that surface in Pencil using existing design system components.
3. Compare Pencil screenshot to the running UI and fix visual deltas immediately.
4. Treat approved Pencil output as the visual contract.
5. Implement the same delta in code, then re-check parity.
6. Do not batch many pages at once; finish and lock each page before moving on.

Scope ownership:
- Pencil owns layout, spacing, typography, and visual states.
- Code owns behavior, data, routing, and accessibility behavior.

## Local Dev Workflow

Use the repo-root commands during implementation and review:

1. Run `pnpm ci:checks` before pushing. This mirrors the main CI verify gate locally.
2. The repo-managed `.githooks/pre-push` hook runs `pnpm ci:checks` automatically and blocks pushes on failures.
3. If hooks stop firing, run `pnpm hooks:install` to restore `core.hooksPath`.
4. Launch the desktop app from the repo root with `pnpm desktop:tauri:dev`.
