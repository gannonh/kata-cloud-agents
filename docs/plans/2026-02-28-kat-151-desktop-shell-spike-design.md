# KAT-151 Design: Desktop Shell Spike Evaluation and Proof of Concept

## Summary

Evaluate `@kata-shadcn/application-shell1` through `@kata-shadcn/application-shell10` as candidate desktop shell primitives for the Tauri app, rank them against both current implementation needs and the full command-center target in `docs/PROJECT_PLAN.md`, then implement a same-ticket proof of concept shell swap for the selected baseline.

## Context

- `KAT-150` completed the desktop-first UI normalization and established registry-first rules.
- The current desktop shell is intentionally minimal:
  - `MemoryRouter` in `apps/desktop/src/App.tsx`
  - route metadata in `apps/desktop/src/routes.ts`
  - shell composition in `apps/desktop/src/components/Layout.tsx`
  - a custom sidebar in `apps/desktop/src/components/Sidebar.tsx`
  - minimal shell state in `apps/desktop/src/store/app.ts`
- The current surface is only a thin shell over placeholder pages, but this spike must evaluate candidates against the full product direction, not only what exists today.
- The screenshots in `docs/screenshots/app-shells` are part of the design source of truth for this comparison.
- `docs/PROJECT_PLAN.md` is a required assessment input because it defines the intended desktop command center and future information density.

## Goals

- Compare all ten application shell candidates using a consistent rubric.
- Use the no-preview registry workflow with temp installs for direct source inspection.
- Produce a ranked recommendation with explicit adopt/adapt/reject guidance.
- Select one shell baseline that fits both the current desktop app and the broader command-center roadmap.
- Land a same-ticket proof of concept shell swap for the chosen baseline.
- Allow small shell-level navigation/state adjustments if the chosen primitive requires them.

## Non-Goals

- No web rollout or web feature parity work in this ticket.
- No page-level product expansion beyond shell integration needs.
- No broad redesign of the route model or feature modules.
- No permanent installation of all ten shells into production paths.

## Constraints

- Desktop-first only; `apps/desktop` is the active implementation surface.
- The private `@kata-shadcn` registry is the source of truth for shell primitives.
- Follow the no-preview workflow from `AGENTS.md`:
  1. inspect registry metadata/source
  2. install to temp paths under `./tmp/registry-install`
  3. compare before integrating
- The comparison must consider both:
  - current implementation fit
  - future command-center fit from `docs/PROJECT_PLAN.md`
- The proof of concept must preserve existing route-driven page rendering and remain scoped to shell-level changes.

## Approaches Considered

### Option A: Analysis-first, single final proof of concept (recommended)

Evaluate all ten shells first, choose one winner, then implement one proof of concept shell swap.

Pros:
- Satisfies the explicit requirement to assess all ten candidates.
- Produces the cleanest recommendation with the least code churn.
- Avoids creating throwaway production integrations for multiple shells.

Cons:
- Defers implementation feedback until the comparison is complete.

### Option B: Parallel mini-proof-of-concepts for finalists

Shortlist a few shells, wire shallow integrations, then decide.

Pros:
- Gives faster experiential feedback on finalists.

Cons:
- Adds substantial rework and branch noise.
- Weakens the evidence quality for the full ten-shell comparison.

### Option C: Screenshot-led early filtering, then deep dive

Use screenshots to reject obvious mismatches early and deeply inspect only a subset.

Pros:
- Faster initial narrowing.

Cons:
- Too weak for this ticket's acceptance criteria because it under-documents rejected candidates.

## Decision

Choose Option A.

This ticket should first complete a full comparative assessment across `application-shell1` through `application-shell10`, then implement one proof of concept shell swap for the selected winner. The comparison should use the screenshot set, registry source inspection, and temp installs for evidence, while the implementation should remain tightly scoped to shell composition, navigation mapping, and shell state.

## Assessment Process

### Required Inputs

- `docs/PROJECT_PLAN.md` for the future desktop command-center scope
- `docs/screenshots/app-shells` for shell visual references
- current desktop shell code:
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/routes.ts`
  - `apps/desktop/src/components/Layout.tsx`
  - `apps/desktop/src/components/Sidebar.tsx`
  - `apps/desktop/src/store/app.ts`

### Candidate Review Workflow

For each `N` in `1..10`:

1. Inspect registry metadata/source for `@kata-shadcn/application-shellN`.
2. Install into `./tmp/registry-install/application-shellN`.
3. Compare the shell against:
   - current route/navigation structure
   - current shell state model
   - current dark desktop styling baseline
   - future command-center needs defined in `docs/PROJECT_PLAN.md`
4. Record:
   - fit gaps
   - dependency impact
   - integration risk
   - opinionation level
   - adopt/adapt/reject disposition

## Comparison Matrix

| Shell | Current Fit | Future Command-Center Fit | Nav Flexibility | Content Flexibility | Opinionation Cost | Dependency Cost | Disposition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| application-shell1 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell2 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell3 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell4 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell5 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell6 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell7 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell8 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell9 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell10 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |

### Comparison Rubric

Each shell should be scored in these dimensions:

1. Current integration fit
   - Can it host the existing route map with limited shell changes?
   - Does it preserve a simple `Layout` + `Outlet` composition?
2. Future command-center fit
   - Can it support the planned desktop command center from `docs/PROJECT_PLAN.md`?
   - Does it scale to Dashboard, Spec Editor, Agent Monitor, Artifacts, Fleet, and Settings without forcing a redesign?
3. Sidebar and navigation flexibility
   - Can it handle a persistent desktop sidebar, collapsible behavior, grouped navigation, and future denser sections?
4. Content region flexibility
   - Does it support generic page content and potentially dense multi-panel workflows?
5. Responsive breakpoint behavior
   - Is the desktop behavior appropriate for Tauri first, rather than over-optimizing for a mobile-first marketing shell pattern?
6. Opinionation cost
   - Does it assume highly specific workflows (for example IDE/file-tree paradigms) that would distort the product model?
7. Dependency and implementation cost
   - How much supporting code and package overhead is introduced?

## Architecture

The ticket should produce two concrete outputs:

1. A design artifact documenting the ten-shell comparison, ranking, recommendation, and selected baseline.
2. A proof-of-concept shell swap in the desktop app using the selected baseline.

The comparison phase stays outside production code except for disposable temp installs. Once a winner is selected, the proof of concept should replace the custom shell composition in `apps/desktop/src/components/Layout.tsx` and adapt surrounding shell code as needed while preserving route-driven page rendering.

## Component Boundaries

The evaluation phase should use disposable install paths only:

- `./tmp/registry-install/application-shell1`
- `./tmp/registry-install/application-shell2`
- ...
- `./tmp/registry-install/application-shell10`

The proof of concept should limit production changes to shell-level files:

- `apps/desktop/src/components/Layout.tsx` as the shell composition root
- `apps/desktop/src/components/Sidebar.tsx` as an adapter, reduction, or removal point
- `apps/desktop/src/routes.ts` as the single source of truth for nav metadata, with only small additive metadata changes if required
- `apps/desktop/src/store/app.ts` for shell interaction state
- `apps/desktop/src/index.css` only if the chosen shell requires small shell-level style normalization

Page components should remain functionally unchanged during this spike.

## Data Flow

- Route definitions continue to originate in `apps/desktop/src/routes.ts`.
- The chosen shell maps route metadata into its expected navigation structure.
- Shell interaction state remains in `apps/desktop/src/store/app.ts`.
- `Layout` remains the location where `Outlet` is rendered.
- Any new state should remain limited to shell concerns such as:
  - collapsed/open navigation
  - mobile sheet state
  - simple section selection metadata if the shell primitive expects it

## Risk Analysis

The primary risk is selecting a shell that looks polished but is structurally too opinionated for the product.

Examples of risky patterns:

- IDE/file-explorer layouts that imply nested explorer panes or workflow-specific affordances
- shells that require fake placeholder content to feel coherent
- shells whose content areas are too specialized for the broad command-center use case
- shells that optimize for marketing-site responsiveness more than dense desktop workflows

Mitigations:

- score future command-center fit separately from current ease of integration
- reject any shell that would require route redesign or page rewrites
- allow adaptation only for low-risk shell-level deltas

## Recommendation Standard

## Recommendation

- Preferred candidate: TBD
- Decision: adopt | adapt | reject
- Required deltas:
  - TBD
- Rejected candidates:
  - TBD

The selected baseline should not be the shell that is merely easiest to drop into the current thin app today. It should be the shell that offers the best balance of:

- immediate integration viability
- low adaptation cost
- durable fit for the full command-center scope in `docs/PROJECT_PLAN.md`

That means a shell with slightly higher near-term adaptation cost can still rank higher than an easier drop-in option if it better supports the long-term desktop information architecture.

## Validation Strategy

### Comparison Deliverable

- Document all ten shells with a consistent matrix.
- Provide a ranked recommendation.
- For each rejected shell, record the rejection reason.
- For the selected baseline, record whether it should be adopted as-is, adapted with defined deltas, or rejected.

### Proof of Concept Deliverable

- Verify the desktop app still renders all existing routes.
- Verify the chosen shell's navigation interactions work.
- Verify any new shell state behaves correctly.
- Verify the existing dark theme baseline remains coherent.
- Run desktop-local checks relevant to touched files, including:
  - desktop tests
  - lint/typecheck for touched code
  - manual desktop run via `pnpm desktop:tauri:dev`

## Acceptance Criteria Mapping

- Comparative compatibility assessment across `application-shell1` through `application-shell10`: covered by the full comparison workflow and rubric.
- Recommendation with preferred candidate(s), rationale, and adopt/adapt/reject guidance: covered by the ranked recommendation standard.
- Implementation checklist and migration steps if adopted/adapted: to be produced in the follow-on implementation plan.
- Same-ticket proof of concept shell swap: explicitly included as a required output.
- Full-project scope, not just current implementation: enforced by the requirement to assess every candidate against `docs/PROJECT_PLAN.md`.
