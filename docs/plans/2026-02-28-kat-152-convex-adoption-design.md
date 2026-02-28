# KAT-152 Design: Adopt Convex for the Data Layer

## Summary

Adopt Convex now as the project’s target data layer and stop extending the current Postgres/Drizzle scaffold. The existing database code is still isolated infrastructure scaffolding, so switching now is materially cheaper than building additional pre-MVP milestones on a stack we already expect to replace.

## Context

- The current data layer lives almost entirely inside `packages/db`.
- The active implementation is still the original Postgres/Drizzle scaffold:
  - `packages/db/src/schema.ts`
  - `packages/db/src/client.ts`
  - `packages/db/drizzle.config.ts`
  - `packages/db/src/migrate.ts`
  - `containers/docker-compose.yml`
- No app, gateway, or agent package currently consumes `@kata/db` at runtime.
- That means this is not a costly migration yet. It is still an architectural pivot while the blast radius is small.

## Decision

Choose Convex as the target data layer now.

This ticket is a decision ticket only. It does not perform the migration. The follow-up ticket will replace the current scaffold, update repository contracts, and revise project documentation to reflect the new backend direction.

## Goals

- Make a clear go/no-go decision on Convex now.
- Avoid building additional pre-MVP work on a data layer we do not intend to keep.
- Establish Convex as the new source of truth for future persistence work.
- Define the exact follow-up scope for the migration ticket.

## Non-Goals

- Do not migrate code in `KAT-152`.
- Do not retrofit existing feature work to use Convex yet.
- Do not redesign every backend interface in this ticket.
- Do not rewrite historical verification artifacts that document what was true when `KAT-106` landed.

## Options Considered

### Option A: Stay on Postgres + Drizzle

Pros:
- Matches the current project plan and existing scaffold.
- Keeps the originally planned `Hono + PostgreSQL + Drizzle` backend shape intact.
- Has no immediate architecture churn.

Cons:
- Extends a stack we are actively reconsidering before it has real downstream consumers.
- Increases future migration cost with each new milestone that assumes SQL migrations and a direct Postgres client.
- Preserves a local scaffold that may not match the eventual product direction.

### Option B: Adopt Convex Now (recommended)

Pros:
- Lowest practical switching cost because the current DB layer is not yet integrated into the rest of the product.
- Avoids building `M1` and `M2` on a temporary persistence model.
- Better aligns with a TypeScript-first stack, built-in reactivity, and the project’s realtime/product ambitions.
- Convex supports direct backend functions, realtime subscriptions, local development deployments, and self-hosting paths.

Cons:
- Changes the backend architecture now rather than later.
- Requires immediate follow-up work to replace existing scaffold assumptions.
- Local deployment support exists, but some development workflows remain newer than the Postgres/Docker baseline.

## Rationale

The deciding factor is timing.

If this repo already had gateway routes, desktop flows, or agent runtimes coupled to Postgres, the migration cost would argue for caution. That is not the current state. Today, the Postgres/Drizzle layer is still mostly a scaffold package plus tests and docs. Waiting only makes the eventual migration more expensive.

The project is still pre-MVP. Building additional milestones on a data layer we already suspect is not the long-term target would create churn for no strategic gain. Since the user is already inclined toward Convex and the remaining risk is architectural fit rather than migration cost, the cleanest move is to make the decision now and execute the migration immediately afterward in a separate ticket.

## Architectural Consequences

- Convex becomes the target persistence layer for future milestone work.
- `packages/db` should be repurposed from a Drizzle/Postgres scaffold into the repo’s Convex integration boundary.
- The repository’s data-layer contract should move from:
  - SQL migrations
  - `pg` connection pooling
  - Drizzle schema declarations
  to:
  - Convex project configuration
  - Convex schema and functions
  - generated client/types and local development workflow
- Project docs that currently name PostgreSQL and Drizzle as the target backend need to be updated.
- Historical proof of prior work can remain archived or preserved as historical documentation; it should not drive new architecture.

## Risks and Mitigations

- Risk: the backend architecture changes faster than the written project plan.
  - Mitigation: the follow-up migration ticket must update `docs/PROJECT_PLAN.md` and milestone references in the same change.
- Risk: Convex local workflow differs from the current Docker-first development assumptions.
  - Mitigation: codify local setup and verification commands directly in the migration ticket and repo docs.
- Risk: downstream tickets still assume the old Postgres/Drizzle contract.
  - Mitigation: update scaffold tests and package contracts first so future work fails fast against stale assumptions.

## Acceptance Criteria Mapping

- The repo has a clear architectural decision: Convex is in, Postgres/Drizzle is out for future work.
- `KAT-152` produces a written design doc with explicit scope boundaries.
- The migration itself is deferred to a dedicated follow-up ticket.
- The follow-up ticket scope includes code, tests, and documentation updates required to make Convex the new baseline.

## Follow-Up Ticket Scope

The next ticket should:

- Replace the `packages/db` Postgres/Drizzle scaffold with a Convex-based scaffold.
- Update scaffold tests that currently enforce Drizzle, SQL migration artifacts, and a Postgres Docker service.
- Revise project planning docs that still describe PostgreSQL and Drizzle as the target stack.
- Preserve historical verification docs as historical evidence, not as active architecture guidance.
