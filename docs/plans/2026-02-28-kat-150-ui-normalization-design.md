# KAT-150 Design: Desktop-First UI Normalization

## Summary

Standardize active UI work on desktop (`apps/desktop`) around the private `@kata-shadcn` registry and enforce anti-drift locally before pushes. Web remains deferred except for shell-level maintenance.

## Context

- Current UI in desktop uses local/custom components for shell and primitives.
- Registry infrastructure exists and is reachable with `x-registry-token`.
- We need one component source of truth to unblock M1 tickets without pattern drift.
- CI failures are frequent on first PR run; we want local fail-fast checks to reduce runner cost.

## Goals

- Desktop-first normalization with registry-first component sourcing.
- Enforce a hard anti-drift rule for UI primitives.
- Add a single local command (`ci:checks`) that mirrors key CI checks.
- Block pushes when local CI checks fail.
- Add a root command to run Tauri desktop dev from monorepo root.

## Non-Goals

- No web feature expansion or web parity work in this ticket.
- No full semantic “equivalent component” analysis; enforcement is rule-based.
- No PR-wrapper workflow in this phase.
- No e2e in default local `ci:checks` (speed-first for daily use).

## Constraints

- Registry endpoint: `https://shadcn-registry-eight.vercel.app/r/{name}.json`
- Auth: `x-registry-token` via `${REGISTRY_TOKEN}`
- Desktop-first sequencing per Linear and AGENTS guidance.

## Approaches Considered

### Option A: Hard CI-only enforcement

- Add checks in GitHub Actions only.
- Pros: central, unavoidable.
- Cons: still burns runner minutes on first failures.

### Option B: Local pre-push gate only

- Block push using local hook running checks.
- Pros: cheapest and earliest feedback.
- Cons: can be bypassed with `--no-verify`.

### Option C: Combined local + CI parity (recommended)

- Add `ci:checks`, run it in pre-push locally, and keep CI as final guard.
- Pros: catches most failures before push while preserving server truth.
- Cons: modest setup complexity (hook path + script).

## Decision

Choose Option C with these concrete rules:

1. Root `ci:checks` runs:
   - `pnpm lint`
   - `pnpm lint:biome`
   - `pnpm typecheck`
   - `pnpm coverage`
   - `pnpm check:ui-drift`
2. Root `desktop:tauri:dev` runs:
   - `pnpm --filter @kata/desktop tauri:dev`
3. `pre-push` hook runs `pnpm ci:checks` and blocks push on failure.
4. CI still runs existing checks; `ci:checks` is added as an explicit early parity step.

## Hard Anti-Drift Rule

The enforcement script (`check:ui-drift`) fails if:

- app-local primitive files are found under `apps/desktop/src` or `apps/web/src` for canonical primitive names (for example: `button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `badge`, `card`, `tabs`, `dialog`, `popover`, `tooltip`, `table`, `sheet`, `dropdown-menu`, `form`, `skeleton`), or
- app code imports these primitives from app-local paths instead of shared UI exports.

Allowed:

- shared primitive imports via `@kata/ui/components/ui/*`
- app-local composition/layout components (for example `Sidebar`, `Layout`, page-level shells)

Exceptions:

- any exception requires explicit ticket/PR note and should be temporary.

## Implementation Outline

1. Add drift checker script at repo root (Node script using filesystem scan + regex import checks).
2. Add package scripts:
   - `check:ui-drift`
   - `ci:checks`
   - `desktop:tauri:dev`
3. Add repo-managed hook path (for example `.githooks/pre-push`) and setup command to enable it.
4. Update CI workflow to run `pnpm ci:checks` in verify job.
5. Document local workflow and override/exception process in AGENTS/docs.

## Validation Strategy

- Local:
  - `pnpm check:ui-drift` passes on current tree.
  - Introduce a known violation and verify failure message includes file and reason.
  - `pnpm ci:checks` runs end-to-end locally.
  - `pnpm desktop:tauri:dev` launches desktop app from root.
- CI:
  - Verify `ci:checks` step executes in Actions.
  - Verify failing drift check blocks PR.

## Risks and Mitigations

- Risk: false positives for legitimate app-local components.
  - Mitigation: restrict checks to canonical primitive names + import patterns.
- Risk: developers bypass local hooks.
  - Mitigation: keep CI required status checks.
- Risk: `coverage` is slower locally.
  - Mitigation: acceptable for pre-push; keep default scope without e2e.

## Acceptance Criteria Mapping

- Desktop-first + web deferred reflected in process and scripts: covered.
- Active work uses registry/shared primitives by default: enforced by drift check.
- Contribution rule for missing components: documented as exception path.
- Verifiable guardrail against drift: `check:ui-drift` + `ci:checks` + pre-push.
- Follow-on M1 tickets unblocked with one consistent UI strategy: expected outcome.
